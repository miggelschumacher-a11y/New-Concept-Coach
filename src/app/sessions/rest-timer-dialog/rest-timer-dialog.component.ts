import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { SoundService } from '../../core/services/sound.service';
import { RestNotificationService } from '../../core/services/rest-notification.service';

export interface RestTimerDialogData {
  // Elapsed seconds at which the first reminder gong plays.
  firstThresholdSeconds: number;
  // Elapsed seconds at which a second, final gong plays - undefined skips
  // it entirely (used for the single-threshold rest-between-exercises timer,
  // and whenever the second rest setting is 0).
  secondThresholdSeconds?: number;
  // The just-finished exercise's own progression/reduction toast message
  // (see SessionsComponent.buildSetFeedbackMessage), folded into this popup
  // instead of shown as a separate snackbar when both would otherwise
  // appear together - only ever set on the between-exercises timer.
  feedbackMessage?: string;
}

// A tap-to-dismiss popup showing a live count-up of the rest just taken,
// beeping once at firstThresholdSeconds and again at secondThresholdSeconds
// if given - see SessionsComponent's maybeShowRestPrompt for when each of
// the two shapes (between sets, single threshold between exercises) is
// opened. disableClose on the dialog.open() call means only this
// component's own close() (the tap) dismisses it, not Escape or a backdrop
// click.
//
// The actual gong is always played by tick() below, from the same
// requestAnimationFrame-independent Date.now() delta the visible ring uses -
// measured directly against this component's own startedAt, this fires
// within milliseconds of its threshold, so it's the only mechanism trusted
// while the dialog is open and visible. A parallel native OS notification
// (see RestNotificationService) exists purely as a backgrounded/screen-off
// fallback, since the WebView's JS timers can be throttled or suspended once
// the screen dims/locks - but it's only ever scheduled once the page has
// actually gone hidden (see handleVisibilityChange), for whichever
// thresholds are still pending at that moment, and cancelled again the
// instant the page comes back to the foreground. An earlier version
// scheduled it unconditionally up front instead and relied on cancelNativeGong
// to cancel each one the moment tick() beeped locally, trusting that to make
// the two mechanisms harmless to run in parallel - but AlarmManager's own
// "at" time is computed from a separate Date.now() reading, taken after
// awaiting the plugin's permission/channel setup, and is therefore never
// guaranteed to line up with this component's startedAt to the second, so a
// native alarm scheduled that far in advance had no guarantee of firing
// exactly in sync with (rather than a little before or after) the precise
// local one it was racing. Only scheduling it once actually needed removes
// that race entirely instead of trying to win it.
@Component({
  selector: 'app-rest-timer-dialog',
  standalone: true,
  imports: [MatDialogModule, TranslatePipe],
  templateUrl: './rest-timer-dialog.component.html',
  styleUrl: './rest-timer-dialog.component.scss'
})
export class RestTimerDialogComponent implements OnInit, OnDestroy {
  elapsedSeconds = 0;
  // Toggled on for PULSE_DURATION_MS whenever a gong fires, so the ring and
  // elapsed-time text can play a short reward animation in sync with the
  // sound instead of the threshold passing silently on-screen.
  pulsing = false;

  // Matches the ring's r="28" in the template - circumference = 2*pi*r.
  readonly ringCircumference = 2 * Math.PI * 28;

  // Updated every animation frame from the exact same Date.now() delta the
  // gong itself is timed against (see updateRing) - never from the
  // once-a-second elapsedSeconds. That used to drive this value instead, with
  // a CSS transition easing each whole-second jump into a smooth sweep, but
  // the transition only *starts* on the tick where a threshold is crossed, so
  // the ring's own "fully closed" frame landed a full second after the gong
  // that was supposed to coincide with it (reported as the gong firing
  // "before" the ring visibly closed). Computing this continuously instead
  // keeps the ring's fraction and the gong's threshold check reading off the
  // same clock, so the ring reaches 1 at essentially the same instant the
  // gong plays, not a whole tick later. Starts fully "empty" (offset ==
  // circumference), same as fraction 0 below.
  ringDashOffset = this.ringCircumference;

  private static readonly PULSE_DURATION_MS = 650;

  private readonly startedAt = Date.now();
  private intervalId?: ReturnType<typeof setInterval>;
  private pulseTimeoutId?: ReturnType<typeof setTimeout>;
  private ringFrameId?: number;
  private firstBeeped = false;
  private secondBeeped = false;
  // Index-aligned with the two thresholds, i.e. [0] is the first gong's
  // native notification id, [1] the second's (sparse - only set for
  // whichever threshold(s) were still pending the last time the page went
  // hidden; see scheduleNativeFallback/handleVisibilityChange).
  private readonly scheduledNotificationIds: (number | undefined)[] = [];
  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.scheduleNativeFallback();
    } else {
      this.cancelAllNativeGongs();
    }
  };

  constructor(
    public readonly dialogRef: MatDialogRef<RestTimerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: RestTimerDialogData,
    private readonly soundService: SoundService,
    private readonly restNotificationService: RestNotificationService
  ) {}

  ngOnInit(): void {
    this.intervalId = setInterval(() => this.tick(), 1000);
    this.ringFrameId = requestAnimationFrame(() => this.updateRing());
    if (this.restNotificationService.isAvailable) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.pulseTimeoutId) {
      clearTimeout(this.pulseTimeoutId);
    }
    if (this.ringFrameId !== undefined) {
      cancelAnimationFrame(this.ringFrameId);
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.cancelAllNativeGongs();
  }

  // Runs every frame rather than once a second (see ringDashOffset's own
  // comment for why) - self-scheduling instead of setInterval so it stops
  // being called at all while the tab is hidden, instead of queuing up calls
  // that would otherwise all fire back-to-back once it's visible again.
  private updateRing(): void {
    this.ringDashOffset = this.computeRingDashOffset((Date.now() - this.startedAt) / 1000);
    this.ringFrameId = requestAnimationFrame(() => this.updateRing());
  }

  private tick(): void {
    this.elapsedSeconds = Math.floor((Date.now() - this.startedAt) / 1000);
    if (!this.firstBeeped && this.elapsedSeconds >= this.data.firstThresholdSeconds) {
      this.firstBeeped = true;
      this.soundService.playGong();
      this.cancelNativeGong(0);
      this.triggerPulse();
    }
    if (!this.secondBeeped && this.data.secondThresholdSeconds !== undefined && this.elapsedSeconds >= this.data.secondThresholdSeconds) {
      this.secondBeeped = true;
      this.soundService.playGong();
      this.cancelNativeGong(1);
      this.triggerPulse();
    }
  }

  // Restarts the CSS pulse animation - clearing the class first (via the
  // timeout below) even when a pulse is already running, so back-to-back
  // gongs (an edge case: identical first/second threshold values) each get
  // their own full-length animation instead of the second one being a no-op
  // because the class was already set.
  private triggerPulse(): void {
    if (this.pulseTimeoutId) {
      clearTimeout(this.pulseTimeoutId);
    }
    this.pulsing = false;
    requestAnimationFrame(() => {
      this.pulsing = true;
      this.pulseTimeoutId = setTimeout(() => {
        this.pulsing = false;
      }, RestTimerDialogComponent.PULSE_DURATION_MS);
    });
  }

  // Schedules the native fallback for whichever threshold(s) haven't beeped
  // yet, with delays recomputed from right now rather than from
  // firstThresholdSeconds/secondThresholdSeconds themselves - the page may
  // have already been visible (and ticking locally) for a while before going
  // hidden.
  private scheduleNativeFallback(): void {
    const remaining: { index: number; delaySeconds: number }[] = [];
    if (!this.firstBeeped) {
      remaining.push({ index: 0, delaySeconds: Math.max(1, this.data.firstThresholdSeconds - this.elapsedSeconds) });
    }
    if (!this.secondBeeped && this.data.secondThresholdSeconds !== undefined) {
      remaining.push({ index: 1, delaySeconds: Math.max(1, this.data.secondThresholdSeconds - this.elapsedSeconds) });
    }
    if (remaining.length === 0) {
      return;
    }
    void this.restNotificationService.scheduleGongs(remaining.map((r) => r.delaySeconds)).then((ids) => {
      if (document.hidden) {
        ids.forEach((id, i) => {
          this.scheduledNotificationIds[remaining[i].index] = id;
        });
      } else {
        // The page already came back to the foreground while this was
        // in flight (scheduleGongs awaits a permission check and a
        // native bridge round-trip, both real async gaps) - storing
        // these now would orphan them, since handleVisibilityChange's
        // cancelAllNativeGongs already ran and won't run again until
        // the page goes hidden a second time.
        if (ids.length > 0) {
          void this.restNotificationService.cancel(ids);
        }
      }
    });
  }

  // Cancels one already-scheduled native notification the instant its
  // matching gong has been played locally (see the class comment) - a no-op
  // if none was ever scheduled for this index (never went hidden, or was
  // unavailable/no permission).
  private cancelNativeGong(index: number): void {
    const id = this.scheduledNotificationIds[index];
    if (id !== undefined) {
      this.scheduledNotificationIds[index] = undefined;
      void this.restNotificationService.cancel([id]);
    }
  }

  private cancelAllNativeGongs(): void {
    const ids = this.scheduledNotificationIds.filter((id): id is number => id !== undefined);
    this.scheduledNotificationIds.length = 0;
    if (ids.length > 0) {
      void this.restNotificationService.cancel(ids);
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  // Only the between-sets timer ever has two independent thresholds (see
  // SessionsComponent.openBetweenSetsRestTimer) - the single-threshold
  // between-exercises timer never sets secondThresholdSeconds, so it always
  // reads as "no second phase" here and keeps the plain, unnumbered label.
  get hasSecondThreshold(): boolean {
    return this.data.secondThresholdSeconds !== undefined;
  }

  // openBetweenSetsRestTimer only ever sets secondThresholdSeconds when it's
  // strictly greater than firstThresholdSeconds, so comparing the live
  // elapsed count against firstThresholdSeconds alone is enough to tell
  // which of the two reminders is the one still ahead.
  get isSecondPhase(): boolean {
    return this.hasSecondThreshold && this.elapsedSeconds >= this.data.firstThresholdSeconds;
  }

  get activeThresholdSeconds(): number {
    return this.isSecondPhase ? this.data.secondThresholdSeconds! : this.data.firstThresholdSeconds;
  }

  // The two thresholds are independent durations from the same start (see
  // openBetweenSetsRestTimer) - either can be the smaller one - so the ring's
  // phase boundaries are just those two values in ascending order, not
  // assumed to already be first-then-second. The ring fills from 0 to 1
  // across the current phase (the gap between whichever boundary was most
  // recently passed and the next one still ahead), and stays full once
  // elapsed has passed every boundary - a single-threshold timer (the
  // between-exercises case) only ever has one boundary to reach.
  //
  // Takes the precise (fractional) elapsed seconds, not the once-a-second
  // elapsedSeconds field - see updateRing/ringDashOffset for why that
  // distinction is what keeps the ring in sync with the gong.
  private computeRingDashOffset(elapsedSecondsPrecise: number): number {
    const boundaries = this.phaseBoundaries();
    let start = boundaries[boundaries.length - 1];
    let target = start;
    for (let i = 0; i < boundaries.length - 1; i++) {
      if (elapsedSecondsPrecise <= boundaries[i + 1]) {
        start = boundaries[i];
        target = boundaries[i + 1];
        break;
      }
    }
    const fraction = target > start ? Math.min(1, Math.max(0, (elapsedSecondsPrecise - start) / (target - start))) : 1;
    return this.ringCircumference * (1 - fraction);
  }

  private phaseBoundaries(): number[] {
    const thresholds = [this.data.firstThresholdSeconds];
    if (this.data.secondThresholdSeconds !== undefined) {
      thresholds.push(this.data.secondThresholdSeconds);
    }
    thresholds.sort((a, b) => a - b);
    return [0, ...thresholds];
  }
}

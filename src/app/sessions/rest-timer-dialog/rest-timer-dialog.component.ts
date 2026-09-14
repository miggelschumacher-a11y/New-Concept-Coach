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

  // Matches the ring's r="28" in the template - circumference = 2*pi*r.
  readonly ringCircumference = 2 * Math.PI * 28;

  private readonly startedAt = Date.now();
  private intervalId?: ReturnType<typeof setInterval>;
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
    if (this.restNotificationService.isAvailable) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.cancelAllNativeGongs();
  }

  private tick(): void {
    this.elapsedSeconds = Math.floor((Date.now() - this.startedAt) / 1000);
    if (!this.firstBeeped && this.elapsedSeconds >= this.data.firstThresholdSeconds) {
      this.firstBeeped = true;
      this.soundService.playGong();
      this.cancelNativeGong(0);
    }
    if (!this.secondBeeped && this.data.secondThresholdSeconds !== undefined && this.elapsedSeconds >= this.data.secondThresholdSeconds) {
      this.secondBeeped = true;
      this.soundService.playGong();
      this.cancelNativeGong(1);
    }
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

  // The two thresholds are independent durations from the same start (see
  // openBetweenSetsRestTimer) - either can be the smaller one - so the ring's
  // phase boundaries are just those two values in ascending order, not
  // assumed to already be first-then-second. The ring fills from 0 to 1
  // across the current phase (the gap between whichever boundary was most
  // recently passed and the next one still ahead), and stays full once
  // elapsed has passed every boundary - a single-threshold timer (the
  // between-exercises case) only ever has one boundary to reach.
  //
  // The <= below (not <) matters: elapsedSeconds reaching a boundary is
  // exactly the instant tick() plays that gong, so the ring must still show
  // that phase as full (fraction 1) at that same tick, moving on to the next
  // phase only the tick after. With a plain <, elapsed===boundary already
  // read as "past it", jumping straight to the next phase's fraction 0 and
  // visibly resetting the ring one tick before its gong actually played.
  get ringDashOffset(): number {
    const boundaries = this.phaseBoundaries();
    let start = boundaries[boundaries.length - 1];
    let target = start;
    for (let i = 0; i < boundaries.length - 1; i++) {
      if (this.elapsedSeconds <= boundaries[i + 1]) {
        start = boundaries[i];
        target = boundaries[i + 1];
        break;
      }
    }
    const fraction = target > start ? Math.min(1, Math.max(0, (this.elapsedSeconds - start) / (target - start))) : 1;
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

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
// The actual gong comes from one of two mechanisms (see
// RestNotificationService): on a native shell, a scheduled OS notification,
// immune to the WebView's own JS timers getting throttled or suspended once
// the screen dims/locks - the in-page tick() below still drives the visible
// ring/elapsed count there, and only skips playing its own (redundant) sound
// once scheduleGongs has actually confirmed the OS notification was
// scheduled (see nativeGongConfirmed) - not merely that this is a native
// shell, since permission can be denied or scheduling can otherwise fail
// silently. In the browser, or whenever that confirmation never arrives,
// tick() plays the sound itself, unchanged from before RestNotificationService
// existed.
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
  private scheduledNotificationIds: number[] = [];
  // True only once scheduleGongs has actually resolved with scheduled ids -
  // isAvailable alone just means "this is a native shell", not that the OS
  // notification was actually scheduled (permission can be denied, or
  // scheduling can otherwise silently fail with no ids and no thrown error).
  // tick()'s in-page fallback keys off this instead of isAvailable so a
  // silent native failure still gets a sound while the dialog itself is open
  // and ticking (i.e. the WebView is foregrounded and its timers aren't
  // being throttled anyway) - the one case the native path was meant to
  // additionally cover, screen-off/backgrounded, is unaffected since this
  // component isn't ticking then regardless.
  private nativeGongConfirmed = false;

  constructor(
    public readonly dialogRef: MatDialogRef<RestTimerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: RestTimerDialogData,
    private readonly soundService: SoundService,
    private readonly restNotificationService: RestNotificationService
  ) {}

  ngOnInit(): void {
    this.intervalId = setInterval(() => this.tick(), 1000);
    if (this.restNotificationService.isAvailable) {
      const delays =
        this.data.secondThresholdSeconds !== undefined
          ? [this.data.firstThresholdSeconds, this.data.secondThresholdSeconds]
          : [this.data.firstThresholdSeconds];
      void this.restNotificationService.scheduleGongs(delays).then((ids) => {
        this.scheduledNotificationIds = ids;
        this.nativeGongConfirmed = ids.length > 0;
      });
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    void this.restNotificationService.cancel(this.scheduledNotificationIds);
  }

  private tick(): void {
    this.elapsedSeconds = Math.floor((Date.now() - this.startedAt) / 1000);
    if (!this.firstBeeped && this.elapsedSeconds >= this.data.firstThresholdSeconds) {
      this.firstBeeped = true;
      if (!this.nativeGongConfirmed) {
        this.soundService.playGong();
      }
    }
    if (!this.secondBeeped && this.data.secondThresholdSeconds !== undefined && this.elapsedSeconds >= this.data.secondThresholdSeconds) {
      this.secondBeeped = true;
      if (!this.nativeGongConfirmed) {
        this.soundService.playGong();
      }
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
  get ringDashOffset(): number {
    const boundaries = this.phaseBoundaries();
    let start = boundaries[boundaries.length - 1];
    let target = start;
    for (let i = 0; i < boundaries.length - 1; i++) {
      if (this.elapsedSeconds < boundaries[i + 1]) {
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

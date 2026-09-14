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
// this is the only mechanism precise while the dialog is open and visible,
// since it re-derives elapsed time from wall-clock deltas every second
// rather than trusting setInterval's own firing time. A parallel native OS
// notification (see RestNotificationService) is also scheduled on a native
// shell purely as a backgrounded/screen-off fallback, since the WebView's JS
// timers can be throttled or suspended once the screen dims/locks - each one
// is cancelled the instant tick() has already played its matching gong
// locally (see cancelNativeGong), so a foregrounded session never risks a
// second, native-alarm-scheduling-imprecision-delayed gong on top of the
// precise local one. AlarmManager's inexact-alarm slack (used whenever the
// exact-alarm permission isn't granted) is what would otherwise show up as
// the gong firing 1-2s late - irrelevant once the dialog is foregrounded and
// this cancels it, and the only case where the native path's own timing is
// what the user actually experiences is exactly the case it exists for:
// screen off, nothing to compare it against.
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
  // Index-aligned with the delays passed to scheduleGongs, i.e. with
  // [firstThresholdSeconds, secondThresholdSeconds?] - so
  // scheduledNotificationIds[0] is the first gong's native notification id,
  // [1] the second's, letting tick() cancel each one individually the
  // moment it has already played that gong locally.
  private scheduledNotificationIds: number[] = [];

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
      this.soundService.playGong();
      this.cancelNativeGong(0);
    }
    if (!this.secondBeeped && this.data.secondThresholdSeconds !== undefined && this.elapsedSeconds >= this.data.secondThresholdSeconds) {
      this.secondBeeped = true;
      this.soundService.playGong();
      this.cancelNativeGong(1);
    }
  }

  // Cancels one already-scheduled native notification the instant its
  // matching gong has been played locally (see the class comment) - a no-op
  // if scheduleGongs hasn't resolved yet, never scheduled one for this index
  // (unavailable/no permission), or it already fired/was already cancelled.
  private cancelNativeGong(index: number): void {
    const id = this.scheduledNotificationIds[index];
    if (id !== undefined) {
      void this.restNotificationService.cancel([id]);
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

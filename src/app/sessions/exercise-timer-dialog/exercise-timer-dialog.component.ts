import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

export interface ExerciseTimerDialogData {
  // The exact same live object SessionsComponent.startCountdown creates and
  // stores in its own countdownStarts map, passed through unchanged rather
  // than copied - startedAt/targetSeconds never change once this dialog is
  // open, but beeped flips true the instant that map's own once-a-second
  // tickCountdowns loop crosses targetSeconds. Reading it through this
  // shared reference every frame is what lets this dialog's own reward pulse
  // fire from the exact same detection as the real gong sound, instead of
  // this component re-deciding the threshold on its own separate clock and
  // risking the two disagreeing (see RestTimerDialogComponent's class
  // comment for the bug that exact shape of duplication caused there).
  // hasTarget is false when the set has no real target seconds - hides the
  // ring (nothing meaningful to fill toward) and, since tickCountdowns never
  // flips beeped in that case either, the reward pulse never fires.
  countdown: { startedAt: number; targetSeconds: number; hasTarget: boolean; beeped: boolean };
}

// A non-modal, non-dismissible popup mirroring a running Time-Based set's
// count-up, opened the instant SessionsComponent.startCountdown starts one -
// shows the live elapsed count next to the set's own prescribed target, plus
// a reward pulse (matching RestTimerDialogComponent's own) the moment the
// target is reached.
//
// Purely a visual layer on top of SessionsComponent's own countdown state,
// with no close() of its own and no backdrop (see the dialog.open() call in
// SessionsComponent.startCountdown) - unlike RestTimerDialogComponent, this
// one can't be tapped away early, and the page underneath stays reachable so
// the set's own stop/done controls in its row can still be used while it's
// up. SessionsComponent closes this dialog itself once the countdown
// actually stops (manually, by reaching its cap, or the set being marked
// done - see SessionsComponent.stopCountdown), so it never lingers open on a
// set that's no longer running.
@Component({
  selector: 'app-exercise-timer-dialog',
  standalone: true,
  imports: [MatDialogModule, TranslatePipe],
  templateUrl: './exercise-timer-dialog.component.html',
  styleUrl: './exercise-timer-dialog.component.scss'
})
export class ExerciseTimerDialogComponent implements OnInit, OnDestroy {
  elapsedSeconds = 0;
  pulsing = false;

  // Matches the ring's r="28" in the template - circumference = 2*pi*r.
  readonly ringCircumference = 2 * Math.PI * 28;
  ringDashOffset = this.ringCircumference;

  private static readonly PULSE_DURATION_MS = 650;

  private pulseTimeoutId?: ReturnType<typeof setTimeout>;
  private frameId?: number;
  // Edge-detects data.countdown.beeped's false->true flip so the pulse
  // fires exactly once per run rather than every frame it stays true.
  private wasBeeped = false;

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: ExerciseTimerDialogData) {}

  ngOnInit(): void {
    this.frameId = requestAnimationFrame(() => this.update());
  }

  ngOnDestroy(): void {
    if (this.frameId !== undefined) {
      cancelAnimationFrame(this.frameId);
    }
    if (this.pulseTimeoutId) {
      clearTimeout(this.pulseTimeoutId);
    }
  }

  // Runs every frame (see RestTimerDialogComponent's ringDashOffset comment
  // for why a once-a-second value plus a CSS transition previously caused a
  // visible desync there) - recomputes the ring from the same continuous
  // clock the elapsed count itself is read from, and keeps filling past a
  // fraction of 1 clamped at "full" once the target is passed, the same way
  // a Time-Based set is allowed to keep counting past its own target.
  private update(): void {
    const elapsedPrecise = (Date.now() - this.data.countdown.startedAt) / 1000;
    this.elapsedSeconds = Math.floor(elapsedPrecise);
    const target = this.data.countdown.targetSeconds;
    const fraction = this.data.countdown.hasTarget && target > 0 ? Math.min(1, elapsedPrecise / target) : 1;
    this.ringDashOffset = this.ringCircumference * (1 - fraction);
    if (this.data.countdown.beeped && !this.wasBeeped) {
      this.wasBeeped = true;
      this.triggerPulse();
    }
    this.frameId = requestAnimationFrame(() => this.update());
  }

  private triggerPulse(): void {
    if (this.pulseTimeoutId) {
      clearTimeout(this.pulseTimeoutId);
    }
    this.pulsing = false;
    requestAnimationFrame(() => {
      this.pulsing = true;
      this.pulseTimeoutId = setTimeout(() => {
        this.pulsing = false;
      }, ExerciseTimerDialogComponent.PULSE_DURATION_MS);
    });
  }
}

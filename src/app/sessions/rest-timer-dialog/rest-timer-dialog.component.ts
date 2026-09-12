import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { SoundService } from '../../core/services/sound.service';

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
// beeping (via the shared Gong sound) once at firstThresholdSeconds and
// again at secondThresholdSeconds if given - see SessionsComponent's
// maybeShowRestPrompt for when each of the two shapes (between sets, single
// threshold between exercises) is opened. disableClose on the dialog.open()
// call means only this component's own close() (the tap) dismisses it, not
// Escape or a backdrop click.
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

  constructor(
    public readonly dialogRef: MatDialogRef<RestTimerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: RestTimerDialogData,
    private readonly soundService: SoundService
  ) {}

  ngOnInit(): void {
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private tick(): void {
    this.elapsedSeconds = Math.floor((Date.now() - this.startedAt) / 1000);
    if (!this.firstBeeped && this.elapsedSeconds >= this.data.firstThresholdSeconds) {
      this.firstBeeped = true;
      this.soundService.playGong();
    }
    if (!this.secondBeeped && this.data.secondThresholdSeconds !== undefined && this.elapsedSeconds >= this.data.secondThresholdSeconds) {
      this.secondBeeped = true;
      this.soundService.playGong();
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  // The ring fills from 0 to 1 across the current phase - 0..firstThreshold
  // before the first gong, then firstThreshold..secondThreshold after it (if
  // a second threshold is set at all). Once the current phase's target is
  // reached the ring just stays full rather than resetting, since a
  // single-threshold timer (the between-exercises case) never gets a second
  // phase and there's nothing further to count down to once both gongs have
  // played.
  get ringDashOffset(): number {
    const target = this.currentPhaseTarget();
    const start = this.currentPhaseStart();
    const fraction = target > start ? Math.min(1, Math.max(0, (this.elapsedSeconds - start) / (target - start))) : 1;
    return this.ringCircumference * (1 - fraction);
  }

  private currentPhaseStart(): number {
    return this.isInSecondPhase() ? this.data.firstThresholdSeconds : 0;
  }

  private currentPhaseTarget(): number {
    return this.isInSecondPhase() ? (this.data.secondThresholdSeconds as number) : this.data.firstThresholdSeconds;
  }

  private isInSecondPhase(): boolean {
    return this.data.secondThresholdSeconds !== undefined && this.elapsedSeconds >= this.data.firstThresholdSeconds;
  }
}

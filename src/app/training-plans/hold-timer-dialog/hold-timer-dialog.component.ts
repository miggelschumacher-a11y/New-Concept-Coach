import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

// A tap-to-stop popup showing a live count-up, for timing a warmup/cooldown
// target's held duration on the spot while editing a plan (see
// TrainingPlansComponent.openHoldTimer) - same "tap the popup to end it"
// gesture as RestTimerDialogComponent, but counts up with no threshold/gong
// (there's nothing to compare against yet, since the whole point is to
// discover the duration) and returns the elapsed seconds as its result
// instead of just closing.
@Component({
  selector: 'app-hold-timer-dialog',
  standalone: true,
  imports: [MatDialogModule, TranslatePipe],
  templateUrl: './hold-timer-dialog.component.html',
  styleUrl: './hold-timer-dialog.component.scss'
})
export class HoldTimerDialogComponent implements OnInit, OnDestroy {
  elapsedSeconds = 0;

  private readonly startedAt = Date.now();
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(public readonly dialogRef: MatDialogRef<HoldTimerDialogComponent, number>) {}

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
  }

  stop(): void {
    this.dialogRef.close(this.elapsedSeconds);
  }
}

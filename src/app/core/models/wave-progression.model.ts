export interface WaveProgressionState {
  id: string;
  exerciseId: string;
  currentReps: number;
  currentWeight: number;
  // Weight the current wave started at, before its own within-wave
  // increments - carried forward and bumped by one increment each time a
  // new wave begins.
  waveStartWeight: number;
  lastUpdated: Date;
}

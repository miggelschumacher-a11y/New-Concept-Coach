export interface DoubleProgressionState {
  // Keyed by exerciseId alone (like the exercise's 1RM), not per-plan — the
  // same exercise shares one progression whichever plan it's trained in.
  id: string;
  exerciseId: string;
  currentWeight: number;
  // Total extra reps earned since the last weight increase. In
  // ADD_TO_ALL_SETS mode this is added to every set directly; in
  // ADD_ONE_TOTAL_REP mode it's distributed one set at a time (see
  // computePrescribedReps in double-progression.util.ts).
  repsAddedThisCycle: number;
  lastUpdated: Date;
}

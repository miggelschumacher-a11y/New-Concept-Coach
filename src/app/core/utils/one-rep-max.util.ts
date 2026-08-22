export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) {
    return 0;
  }
  const raw = reps === 1 ? weight : weight * (1 + reps / 30);
  return Math.round(raw * 100) / 100;
}

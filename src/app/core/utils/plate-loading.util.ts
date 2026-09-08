export interface PlateLoadingItem {
  weight: number;
  // Per side - the plate is physically loaded on both sides, so this many
  // pairs are actually used (2x this count total, out of the owned quantity).
  count: number;
}

export interface PlateLoadingResult {
  perSide: PlateLoadingItem[];
  // >0 (after rounding) means the target weight couldn't be matched exactly
  // with the plates on hand - same limitation every real-world plate
  // calculator has once you run out of small enough plates.
  remainingPerSide: number;
}

// Greedy, descending-weight fill for symmetric 2-sided loading (a barbell,
// or a single adjustable dumbbell loaded on both ends) - not always optimal
// for oddly-sized inventories, but matches how virtually every plate
// calculator works and is more than sufficient for a real gym's plate set.
//
// singleSided (ExerciseSet.singleSidedLoading) covers the opposite case -
// the whole remaining weight is loaded on one side only (e.g. a landmine
// press), so it isn't halved, and every owned plate is available (not just
// floor(quantity / 2) pairs).
export function calculatePlateLoading(
  targetWeight: number,
  equipmentWeight: number,
  plates: { weight: number; quantity: number }[],
  singleSided = false
): PlateLoadingResult {
  let remaining = Math.max(0, targetWeight - equipmentWeight) / (singleSided ? 1 : 2);
  const perSide: PlateLoadingItem[] = [];
  const sorted = [...plates].filter((plate) => plate.weight > 0).sort((a, b) => b.weight - a.weight);
  for (const plate of sorted) {
    const available = singleSided ? plate.quantity : Math.floor(plate.quantity / 2);
    let count = 0;
    while (count < available && remaining - plate.weight >= -0.01) {
      remaining = Math.max(0, remaining - plate.weight);
      count++;
    }
    if (count > 0) {
      perSide.push({ weight: plate.weight, count });
    }
  }
  return { perSide, remainingPerSide: Math.round(remaining * 100) / 100 };
}

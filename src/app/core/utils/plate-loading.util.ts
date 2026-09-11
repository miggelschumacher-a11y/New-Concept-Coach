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

// Exact search for symmetric 2-sided loading (a barbell, or a single
// adjustable dumbbell loaded on both ends): finds the combination of owned
// plates that gets closest to the target without exceeding it, using as few
// plates as possible and preferring heavier ones on a tie. A plain
// heaviest-first greedy fill misses exact solutions whenever the small plates
// don't divide each other evenly - e.g. 77 KG on one side from 20/15/1.25/0.5
// plates: greedy stops at 76.75 (3x20 + 15 + 1.25 + 0.5), while
// 3x20 + 15 + 4x0.5 hits 77 exactly.
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
  const remaining = Math.max(0, targetWeight - equipmentWeight) / (singleSided ? 1 : 2);

  // Owned plates merged by weight (in hundredths - the finest precision a
  // weight field allows), lightest first, each with how many fit on one side.
  const quantityByCents = new Map<number, number>();
  for (const plate of plates) {
    const cents = Math.round(plate.weight * 100);
    if (cents > 0 && plate.quantity > 0) {
      quantityByCents.set(cents, (quantityByCents.get(cents) ?? 0) + plate.quantity);
    }
  }
  const types = [...quantityByCents.entries()]
    .map(([cents, quantity]) => ({ cents, available: singleSided ? quantity : Math.floor(quantity / 2) }))
    .filter((type) => type.available > 0)
    .sort((a, b) => a.cents - b.cents);
  if (types.length === 0 || remaining <= 0) {
    return { perSide: [], remainingPerSide: Math.round(remaining * 100) / 100 };
  }

  // Work in multiples of the plates' greatest common divisor to keep the
  // search small, capped at what the whole inventory can hold anyway.
  const step = types.reduce((divisor, type) => greatestCommonDivisor(divisor, type.cents), 0);
  const inventoryUnits = types.reduce((sum, type) => sum + (type.available * type.cents) / step, 0);
  const capacity = Math.min(Math.floor((remaining * 100) / step + 1e-6), inventoryUnits);

  // fewestPlates[w]: fewest plates adding up to exactly w units so far
  // (Infinity = not reachable); countsByType[t][w]: how many of type t that
  // solution uses. Types are added lightest first and each one takes the
  // highest count on a tie, so the final solution leans on heavier plates.
  let fewestPlates = new Float64Array(capacity + 1).fill(Infinity);
  fewestPlates[0] = 0;
  const countsByType: Uint16Array[] = [];
  for (const type of types) {
    const units = type.cents / step;
    const next = new Float64Array(capacity + 1).fill(Infinity);
    const counts = new Uint16Array(capacity + 1);
    for (let w = 0; w <= capacity; w++) {
      for (let count = Math.min(type.available, Math.floor(w / units)); count >= 0; count--) {
        const plateCount = fewestPlates[w - count * units] + count;
        if (plateCount < next[w]) {
          next[w] = plateCount;
          counts[w] = count;
        }
      }
    }
    countsByType.push(counts);
    fewestPlates = next;
  }

  let loadedUnits = capacity;
  while (loadedUnits > 0 && fewestPlates[loadedUnits] === Infinity) {
    loadedUnits--;
  }

  // Walk back from the heaviest type, so perSide comes out heaviest first.
  const perSide: PlateLoadingItem[] = [];
  let w = loadedUnits;
  for (let t = types.length - 1; t >= 0; t--) {
    const count = countsByType[t][w];
    if (count > 0) {
      perSide.push({ weight: types[t].cents / 100, count });
      w -= (count * types[t].cents) / step;
    }
  }
  const remainingAfterLoading = remaining - (loadedUnits * step) / 100;
  return { perSide, remainingPerSide: Math.round(remainingAfterLoading * 100) / 100 };
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

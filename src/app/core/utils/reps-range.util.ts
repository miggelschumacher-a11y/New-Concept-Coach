export interface RepsRange {
  min: number;
  max: number;
}

const REPS_MIN = 0;
const REPS_MAX = 10000;

function clampReps(value: number): number {
  return Math.min(Math.max(value, REPS_MIN), REPS_MAX);
}

// Accepts a plain number ('8') or a from-to range ('8-12'); also tolerates a
// raw number for backward compatibility with data written before reps became
// a string. Returns {0, 0} for anything unparseable.
export function parseRepsRange(value: string | number): RepsRange {
  const numbers = String(value)
    .split('-')
    .map((part) => parseInt(part, 10))
    .filter((n) => Number.isFinite(n))
    .map(clampReps);
  if (numbers.length === 0) {
    return { min: 0, max: 0 };
  }
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

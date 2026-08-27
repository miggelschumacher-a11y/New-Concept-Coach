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

// Normalizes a from-to input into the canonical stored form: a single
// number when both sides match, otherwise 'min-max' (sorted ascending).
export function normalizeRepsRange(value: string): string {
  const { min, max } = parseRepsRange(value);
  return min === max ? String(min) : `${min}-${max}`;
}

// Strips characters typed into a reps field down to digits and a single
// dash while the user is still typing (final clamping happens on blur via
// normalizeRepsRange), mirroring the weight field's input sanitizer.
export function sanitizeRepsTyping(value: string): string {
  const cleaned = value.replace(/[^\d-]/g, '');
  const dashIndex = cleaned.indexOf('-');
  if (dashIndex === -1) {
    return cleaned.slice(0, 5);
  }
  const first = cleaned.slice(0, dashIndex).slice(0, 5);
  const second = cleaned.slice(dashIndex + 1).replace(/-/g, '').slice(0, 5);
  return `${first}-${second}`;
}

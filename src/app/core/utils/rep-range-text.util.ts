// Shared text format for the Double Progression rep-range field: unlike the
// per-set target-reps field elsewhere in the app (which also accepts a bare
// single number, e.g. "10"), this single field replaces what used to be two
// separate required numbers (lower/upper bound), so a "from-to" range is
// mandatory here - "4-8" or "6-10+" (the trailing "+" marking the upper
// bound as AMRAP), never a bare "8".
export interface RepRange {
  lowerReps: number;
  upperReps: number;
  isAmrap: boolean;
}

const REP_RANGE_PATTERN = /^(\d{1,3})-(\d{1,3})(\+)?$/;

// Used on (input) to sanitize keystrokes as the user types, same idea as the
// per-set target-reps field's own input handler - restricts to digits, then
// optionally a dash and more digits, then optionally a trailing "+", but
// (unlike that field) never accepts "+" directly after the first number
// alone, since a range is required.
export function sanitizeRepRangeInput(value: string): string {
  return value.match(/^\d{1,3}(?:-\d{1,3}\+?|-)?/)?.[0] ?? '';
}

// Returns null for anything that isn't a well-formed, non-backwards range -
// the caller decides what to do with an invalid value (this field's callers
// revert the input to the last valid range, matching this page's other
// numeric fields' silent-correction convention).
export function parseRepRangeText(text: string): RepRange | null {
  const match = text.trim().match(REP_RANGE_PATTERN);
  if (!match) {
    return null;
  }
  const lowerReps = Math.min(Math.max(parseInt(match[1], 10), 1), 100);
  const upperReps = Math.min(Math.max(parseInt(match[2], 10), 1), 100);
  if (upperReps < lowerReps) {
    return null;
  }
  return { lowerReps, upperReps, isAmrap: !!match[3] };
}

export function formatRepRangeText(range: { lowerReps: number; upperReps: number; isAmrap?: boolean }): string {
  return `${range.lowerReps}-${range.upperReps}${range.isAmrap ? '+' : ''}`;
}

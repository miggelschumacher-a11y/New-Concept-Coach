// Every seconds field in the app (set durations, target durations, the three
// rest timers) is entered and shown as hours:minutes:seconds, e.g. 01:01:08 -
// hours up to 99, minutes and seconds up to 59, all three always with a
// leading zero. The stored value stays a plain number of seconds.

export const MAX_DURATION_SECONDS = 99 * 3600 + 59 * 60 + 59;

const MAX_DURATION_DIGITS = 6;

interface DurationParts {
  hours: number;
  minutes: number;
  seconds: number;
}

// Free text (a paste, or input the browser applied itself) fills from the
// right, like a pocket calculator: the digits 1, 0, 1, 0, 8 yield 01:01:08,
// and colons among them are simply ignored. Digits beyond six (hh mm ss) are
// dropped, and minutes/seconds above 59 are clamped to 59. Returns null when
// the text holds no digit at all (an empty field). Typing into an input goes
// through DurationMaskDirective's per-segment editing instead.
function durationParts(text: string): DurationParts | null {
  const digits = text.replace(/\D/g, '');
  if (digits === '') {
    return null;
  }
  const padded = digits.replace(/^0+/, '').slice(0, MAX_DURATION_DIGITS).padStart(MAX_DURATION_DIGITS, '0');
  return {
    hours: parseInt(padded.slice(0, 2), 10),
    minutes: Math.min(59, parseInt(padded.slice(2, 4), 10)),
    seconds: Math.min(59, parseInt(padded.slice(4, 6), 10))
  };
}

function formatParts(parts: DurationParts): string {
  return `${String(parts.hours).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')}:${String(parts.seconds).padStart(2, '0')}`;
}

// The well-formed text for pasted or otherwise unstructured input - '' for an
// empty field, so an optional field (a rest override, a target) can still be
// left blank.
export function maskDurationInput(text: string): string {
  const parts = durationParts(text);
  return parts ? formatParts(parts) : '';
}

// Total seconds a masked (or plain-digit) text stands for; NaN for an empty
// field, matching what parseInt returned for one before these fields had a
// mask, so callers' existing "blank means unset/0" handling keeps working.
export function parseDuration(text: string): number {
  const parts = durationParts(text);
  return parts ? parts.hours * 3600 + parts.minutes * 60 + parts.seconds : NaN;
}

export function formatDuration(totalSeconds: number): string {
  const clamped = Math.min(Math.max(Math.floor(totalSeconds), 0), MAX_DURATION_SECONDS);
  return formatParts({
    hours: Math.floor(clamped / 3600),
    minutes: Math.floor((clamped % 3600) / 60),
    seconds: clamped % 60
  });
}

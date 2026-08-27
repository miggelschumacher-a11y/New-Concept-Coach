import { BodyWeightEntry } from '../models/body-weight-entry.model';

export interface BodyWeightLookupResult {
  entry: BodyWeightEntry;
  // true when no entry is dated at or before the target - `entry` is the
  // oldest one available instead, offered as a best-effort approximation
  // rather than an exact match.
  isFallback: boolean;
}

// Finds the body weight entry with the latest timestamp that is not after
// the target date/time (e.g. a session's start time) - the most recently
// known weight as of that exact moment, down to the minute, not just the
// calendar day. If every entry is later than the target (nothing recorded
// yet as of that moment), returns the oldest entry available instead, with
// isFallback set so callers can confirm before using it. Returns null only
// when there are no entries at all.
export function findBodyWeightForDate(targetDate: Date, entries: BodyWeightEntry[]): BodyWeightLookupResult | null {
  if (entries.length === 0) {
    return null;
  }
  const targetTime = targetDate.getTime();
  let best: BodyWeightEntry | null = null;
  let bestTime = -Infinity;
  let oldest = entries[0];
  let oldestTime = new Date(oldest.timestamp).getTime();
  for (const entry of entries) {
    const entryTime = new Date(entry.timestamp).getTime();
    if (entryTime <= targetTime && entryTime > bestTime) {
      bestTime = entryTime;
      best = entry;
    }
    if (entryTime < oldestTime) {
      oldestTime = entryTime;
      oldest = entry;
    }
  }
  return best ? { entry: best, isFallback: false } : { entry: oldest, isFallback: true };
}

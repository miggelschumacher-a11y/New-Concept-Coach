import { BodyWeightEntry } from '../models/body-weight-entry.model';

// Picks the body weight entry with the latest timestamp that is not after
// the target date/time (e.g. a session's start time) - the most recently
// known weight as of that exact moment, down to the minute, not just the
// calendar day. Returns null if every entry is later than the target.
export function findBodyWeightForDate(targetDate: Date, entries: BodyWeightEntry[]): BodyWeightEntry | null {
  const targetTime = targetDate.getTime();
  let best: BodyWeightEntry | null = null;
  let bestTime = -Infinity;
  for (const entry of entries) {
    const entryTime = new Date(entry.timestamp).getTime();
    if (entryTime <= targetTime && entryTime > bestTime) {
      bestTime = entryTime;
      best = entry;
    }
  }
  return best;
}

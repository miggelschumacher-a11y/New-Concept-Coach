export interface HeartRateZone {
  minAge: number;
  maxAge: number | null;
  hfMax: string;
}

export const HEART_RATE_ZONES: HeartRateZone[] = [
  { minAge: 15, maxAge: 19, hfMax: '201–205' },
  { minAge: 20, maxAge: 24, hfMax: '196–200' },
  { minAge: 25, maxAge: 29, hfMax: '191–195' },
  { minAge: 30, maxAge: 34, hfMax: '186–190' },
  { minAge: 35, maxAge: 39, hfMax: '181–185' },
  { minAge: 40, maxAge: 44, hfMax: '176–180' },
  { minAge: 45, maxAge: 49, hfMax: '171–175' },
  { minAge: 50, maxAge: 54, hfMax: '166–170' },
  { minAge: 55, maxAge: 59, hfMax: '161–165' },
  { minAge: 60, maxAge: 64, hfMax: '156–160' },
  { minAge: 65, maxAge: 69, hfMax: '151–155' },
  { minAge: 70, maxAge: 74, hfMax: '146–150' },
  { minAge: 75, maxAge: null, hfMax: '≤145' }
];

export function findHeartRateMax(age: number): string | null {
  const zone = HEART_RATE_ZONES.find((z) => age >= z.minAge && (z.maxAge === null || age <= z.maxAge));
  return zone?.hfMax ?? null;
}

export interface HeartRateRange {
  min: number;
  max: number;
}

// Parses an hfMax display string ('176–180' or the open-ended '≤145') into
// numeric bounds so it can be used to compute actual bpm values per zone.
export function parseHeartRateRange(hfMax: string): HeartRateRange | null {
  const numbers = hfMax.match(/\d+/g)?.map(Number);
  if (!numbers || numbers.length === 0) {
    return null;
  }
  return numbers.length === 1 ? { min: numbers[0], max: numbers[0] } : { min: numbers[0], max: numbers[1] };
}

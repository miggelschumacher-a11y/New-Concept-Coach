// Names are compared ignoring case and surrounding blanks, so "5x5 Strength"
// and "  5X5 STRENGTH " count as the same.
export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function isNameTaken(name: string, takenNames: readonly string[]): boolean {
  const normalized = normalizeName(name);
  return !!normalized && takenNames.some((taken) => normalizeName(taken) === normalized);
}

// `base` itself if it is free, otherwise "base 2", "base 3", ... - the first
// of those not in takenNames.
export function uniqueName(base: string, takenNames: readonly string[]): string {
  if (!isNameTaken(base, takenNames)) {
    return base;
  }
  for (let counter = 2; ; counter++) {
    const candidate = `${base} ${counter}`;
    if (!isNameTaken(candidate, takenNames)) {
      return candidate;
    }
  }
}

import { isNameTaken, uniqueName } from './unique-name.util';

describe('unique-name.util', () => {
  describe('isNameTaken', () => {
    it('ignores case and surrounding blanks', () => {
      expect(isNameTaken('  5X5 STRENGTH ', ['5x5 Strength'])).toBeTrue();
    });

    it('is false for a different or blank name', () => {
      expect(isNameTaken('5x5', ['5x5 Strength'])).toBeFalse();
      expect(isNameTaken('   ', ['', 'x'])).toBeFalse();
    });
  });

  describe('uniqueName', () => {
    it('keeps a free name as it is', () => {
      expect(uniqueName('Plan (Kopie)', ['Plan'])).toBe('Plan (Kopie)');
    });

    it('appends the first free number to a taken name', () => {
      expect(uniqueName('Plan (Kopie)', ['Plan', 'plan (kopie)'])).toBe('Plan (Kopie) 2');
      expect(uniqueName('Plan (Kopie)', ['Plan (Kopie)', 'Plan (Kopie) 2'])).toBe('Plan (Kopie) 3');
    });
  });
});

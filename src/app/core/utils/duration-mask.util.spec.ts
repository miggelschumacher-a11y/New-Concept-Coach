import { formatDuration, MAX_DURATION_SECONDS, maskDurationInput, parseDuration } from './duration-mask.util';

describe('duration mask', () => {
  it('formats seconds as h:mm:ss with leading zeros on minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00:00');
    expect(formatDuration(8)).toBe('0:00:08');
    expect(formatDuration(68)).toBe('0:01:08');
    expect(formatDuration(3668)).toBe('1:01:08');
    expect(formatDuration(MAX_DURATION_SECONDS)).toBe('99:59:59');
  });

  it('clamps out-of-range seconds when formatting', () => {
    expect(formatDuration(-5)).toBe('0:00:00');
    expect(formatDuration(MAX_DURATION_SECONDS + 1000)).toBe('99:59:59');
  });

  it('fills the mask from the right for pasted digits', () => {
    expect(maskDurationInput('1')).toBe('0:00:01');
    expect(maskDurationInput('10')).toBe('0:00:10');
    expect(maskDurationInput('108')).toBe('0:01:08');
    expect(maskDurationInput('10108')).toBe('1:01:08');
  });

  it('ignores colons and non-digits, and drops digits beyond hh:mm:ss', () => {
    expect(maskDurationInput('1:01:08')).toBe('1:01:08');
    expect(maskDurationInput('1:01:080')).toBe('10:10:59');
    expect(maskDurationInput('1234567')).toBe('12:34:56');
    expect(maskDurationInput('ab')).toBe('');
  });

  it('shifts digits back right when one is dropped', () => {
    expect(maskDurationInput('1:01:0')).toBe('0:10:10');
  });

  it('clamps minutes and seconds to 59', () => {
    expect(maskDurationInput('75')).toBe('0:00:59');
    expect(maskDurationInput('9999')).toBe('0:59:59');
    expect(maskDurationInput('999999')).toBe('99:59:59');
  });

  it('keeps an empty field empty and a typed zero as zero', () => {
    expect(maskDurationInput('')).toBe('');
    expect(maskDurationInput('0')).toBe('0:00:00');
    expect(parseDuration('')).toBeNaN();
    expect(parseDuration('0:00:00')).toBe(0);
  });

  it('parses masked text back to seconds', () => {
    expect(parseDuration('1:01:08')).toBe(3668);
    expect(parseDuration('0:00:30')).toBe(30);
    expect(parseDuration('99:59:59')).toBe(MAX_DURATION_SECONDS);
    expect(parseDuration(formatDuration(12345))).toBe(12345);
  });
});

import { TIMER_RING_CIRCUMFERENCE, TIMER_RING_STROKE_WIDTH, timerRingDashOffset } from './timer-ring.util';

describe('timerRingDashOffset', () => {
  // The drawn arc is the dash plus a round cap (half a stroke width) on each
  // end, i.e. dash + stroke width.
  const visibleArc = (offset: number) => TIMER_RING_CIRCUMFERENCE - offset + TIMER_RING_STROKE_WIDTH;

  it('draws no dash at all while nothing has elapsed', () => {
    expect(timerRingDashOffset(0)).toBeCloseTo(TIMER_RING_CIRCUMFERENCE, 6);
  });

  it('closes the ring exactly at fraction 1 - the two caps meet', () => {
    expect(visibleArc(timerRingDashOffset(1))).toBeCloseTo(TIMER_RING_CIRCUMFERENCE, 6);
  });

  it('keeps the visible arc proportional to the fraction once past the first cap', () => {
    for (const fraction of [0.25, 0.5, 0.75, 0.97, 0.999]) {
      expect(visibleArc(timerRingDashOffset(fraction))).toBeCloseTo(fraction * TIMER_RING_CIRCUMFERENCE, 6);
    }
  });

  it('does not look closed before fraction 1', () => {
    // 3 minutes: where the old fraction * circumference dash already looked
    // shut (a stroke width short of the circumference), 6s early.
    const fraction = (180 - 6) / 180;
    expect(visibleArc(timerRingDashOffset(fraction))).toBeLessThan(TIMER_RING_CIRCUMFERENCE);
  });

  it('clamps out-of-range fractions', () => {
    expect(timerRingDashOffset(-1)).toBeCloseTo(timerRingDashOffset(0), 6);
    expect(timerRingDashOffset(2)).toBeCloseTo(timerRingDashOffset(1), 6);
  });
});

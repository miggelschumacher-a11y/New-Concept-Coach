// Geometry of the progress ring both timer popups draw (the rest timer and
// the Time-Based exercise timer): an SVG circle of radius 28 stroked 6 wide
// with round line caps, filled by stroke-dasharray/-dashoffset. Keep
// TIMER_RING_STROKE_WIDTH in sync with the stroke-width of the
// *-ring-progress rule in both components' stylesheets.
export const TIMER_RING_RADIUS = 28;
export const TIMER_RING_STROKE_WIDTH = 6;
export const TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * TIMER_RING_RADIUS;

// The stroke-dashoffset that makes the ring LOOK `fraction` (0..1) filled.
//
// A round cap sticks half a stroke width out past each end of the dash, so
// the drawn arc is the dash plus one full stroke width, and the ring's two
// ends touch - i.e. it looks closed - as soon as the dash is a stroke width
// short of the whole circumference, not only when it is the whole
// circumference. Setting the dash to fraction * circumference therefore made
// the ring look shut about 3.4% of the timer early: a few seconds ahead of
// the gong on a multi-minute rest. Subtracting the stroke width from the
// dash makes the visible arc (dash + caps) exactly fraction * circumference,
// so the ring closes at the same instant the gong plays. The dash can't get
// shorter than nothing, so for the first stroke width of progress the ring
// shows just its start cap.
export function timerRingDashOffset(fraction: number): number {
  const visibleArc = Math.min(1, Math.max(0, fraction)) * TIMER_RING_CIRCUMFERENCE;
  const dashLength = Math.max(0, visibleArc - TIMER_RING_STROKE_WIDTH);
  return TIMER_RING_CIRCUMFERENCE - dashLength;
}

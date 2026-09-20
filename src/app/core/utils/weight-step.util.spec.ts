import { defaultWeightStep, exerciseWeightStep } from './weight-step.util';

describe('weight step', () => {
  it('defaults to 2.5 for upper-body and 5 for lower-body exercises', () => {
    expect(defaultWeightStep({ weightCategory: 'UPPER_BODY' })).toBe(2.5);
    expect(defaultWeightStep({ weightCategory: 'LOWER_BODY' })).toBe(5);
  });

  it('treats an exercise without a body region, and no exercise at all, as upper body', () => {
    expect(defaultWeightStep({})).toBe(2.5);
    expect(defaultWeightStep(undefined)).toBe(2.5);
  });

  it('uses the exercise\'s own step once entered, else the default', () => {
    expect(exerciseWeightStep({ weightCategory: 'LOWER_BODY', weightStep: 1.25 })).toBe(1.25);
    expect(exerciseWeightStep({ weightCategory: 'LOWER_BODY' })).toBe(5);
    expect(exerciseWeightStep({ weightCategory: 'UPPER_BODY', weightStep: 0 })).toBe(2.5);
  });
});

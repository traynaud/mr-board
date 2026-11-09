import { isToReview } from './is-to-review.js';

describe('isToReview', () => {
  it('is true without reviewer', () => {
    expect(isToReview({ reviewers: [] })).toBe(true);
  });

  it('is false with a reviewer', () => {
    expect(isToReview({ reviewers: [{}] })).toBe(false);
  });

  it('is false with several reviewers', () => {
    expect(isToReview({ reviewers: [{}, {}] })).toBe(false);
  });
});

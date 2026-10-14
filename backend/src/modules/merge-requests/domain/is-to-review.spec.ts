import { isToReview } from './is-to-review.js';

describe('isToReview', () => {
  it('is true without reviewer and without comment', () => {
    expect(isToReview({ reviewers: [], commentsCount: 0 })).toBe(true);
  });

  it('is false with a reviewer', () => {
    expect(isToReview({ reviewers: [{}], commentsCount: 0 })).toBe(false);
  });

  it('is false with at least one comment', () => {
    expect(isToReview({ reviewers: [], commentsCount: 1 })).toBe(false);
  });

  it('is false with both a reviewer and comments', () => {
    expect(isToReview({ reviewers: [{}, {}], commentsCount: 3 })).toBe(false);
  });
});

import { resolveReadyAt } from './resolve-ready-at';

const CREATED = '2026-09-01T10:00:00.000Z';
const NOW = '2026-09-11T08:00:00.000Z';
const PREVIOUS_READY = '2026-09-05T09:00:00.000Z';

describe('resolveReadyAt', () => {
  it('should_use_gitlab_created_at_when_never_seen_and_not_draft', () => {
    expect(
      resolveReadyAt({
        existing: null,
        incomingDraft: false,
        gitlabCreatedAt: CREATED,
        now: NOW,
      }),
    ).toBe(CREATED);
  });

  it('should_return_null_when_never_seen_and_draft', () => {
    expect(
      resolveReadyAt({
        existing: null,
        incomingDraft: true,
        gitlabCreatedAt: CREATED,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('should_use_now_when_transitioning_from_draft_to_non_draft', () => {
    expect(
      resolveReadyAt({
        existing: { draft: true, readyAt: null },
        incomingDraft: false,
        gitlabCreatedAt: CREATED,
        now: NOW,
      }),
    ).toBe(NOW);
  });

  it('should_keep_existing_ready_at_when_staying_non_draft', () => {
    expect(
      resolveReadyAt({
        existing: { draft: false, readyAt: PREVIOUS_READY },
        incomingDraft: false,
        gitlabCreatedAt: CREATED,
        now: NOW,
      }),
    ).toBe(PREVIOUS_READY);
  });

  it('should_return_null_when_transitioning_from_non_draft_to_draft', () => {
    expect(
      resolveReadyAt({
        existing: { draft: false, readyAt: PREVIOUS_READY },
        incomingDraft: true,
        gitlabCreatedAt: CREATED,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('should_stay_null_when_remaining_draft', () => {
    expect(
      resolveReadyAt({
        existing: { draft: true, readyAt: null },
        incomingDraft: true,
        gitlabCreatedAt: CREATED,
        now: NOW,
      }),
    ).toBeNull();
  });
});

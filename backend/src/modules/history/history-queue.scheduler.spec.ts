import { HistoryEnrichmentService } from './history-enrichment.service.js';
import { HistoryQueueScheduler } from './history-queue.scheduler.js';

describe('HistoryQueueScheduler', () => {
  const originalEnv = process.env.NODE_ENV;
  const enrichment = { processDue: jest.fn().mockResolvedValue(0) };
  let scheduler: HistoryQueueScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new HistoryQueueScheduler(
      enrichment as unknown as HistoryEnrichmentService,
    );
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should_do_nothing_in_the_test_environment', async () => {
    process.env.NODE_ENV = 'test';

    await scheduler.tick();

    expect(enrichment.processDue).not.toHaveBeenCalled();
  });

  it('should_process_the_queue_on_each_tick_outside_tests', async () => {
    process.env.NODE_ENV = 'production';

    await scheduler.tick();

    expect(enrichment.processDue).toHaveBeenCalledTimes(1);
  });
});

import { summarizeLabels } from './summarize-labels';

describe('summarizeLabels', () => {
  it('should_show_every_label_and_report_no_extra_when_there_are_at_most_two', () => {
    expect(summarizeLabels([])).toEqual({ shown: [], extraCount: 0, tooltip: '' });
    expect(summarizeLabels(['bug'])).toEqual({
      shown: ['bug'],
      extraCount: 0,
      tooltip: 'bug',
    });
    expect(summarizeLabels(['bug', 'urgent'])).toEqual({
      shown: ['bug', 'urgent'],
      extraCount: 0,
      tooltip: 'bug, urgent',
    });
  });

  it('should_show_only_the_first_two_and_report_the_rest_as_extra_rg_028_07', () => {
    const result = summarizeLabels(['bug', 'urgent', 'backend', 'v2']);

    expect(result.shown).toEqual(['bug', 'urgent']);
    expect(result.extraCount).toBe(2);
  });

  it('should_list_every_label_in_the_tooltip_regardless_of_the_truncation', () => {
    const result = summarizeLabels(['bug', 'urgent', 'backend', 'v2']);

    expect(result.tooltip).toBe('bug, urgent, backend, v2');
  });
});

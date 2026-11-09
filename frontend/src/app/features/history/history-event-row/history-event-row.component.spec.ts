import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting, t } from '../../../core/i18n/testing';
import { HistoryEvent } from '../../../models/history.model';
import { ProjectTagStyle } from '../../../shared/project-color/project-tag-style';
import { HistoryEventRowComponent } from './history-event-row.component';

function event(overrides: Partial<HistoryEvent> = {}): HistoryEvent {
  return {
    id: 1,
    occurredAt: '2026-11-09T10:30:00.000Z',
    type: 'approved',
    status: 'confirmed',
    projectId: 1,
    projectAlias: 'api',
    mrIid: 12,
    mrTitle: 'Corriger le tri',
    mrWebUrl: 'https://gitlab.com/equipe/api/-/merge_requests/12',
    actor: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
    oldValue: null,
    newValue: null,
    ...overrides,
  };
}

@Component({
  imports: [HistoryEventRowComponent],
  template: `<app-history-event-row [event]="event()" [tagStyle]="tagStyle()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly event = signal<HistoryEvent>(event());
  readonly tagStyle = signal<ProjectTagStyle | null>(null);
}

describe('HistoryEventRowComponent', () => {
  async function setup(ev: HistoryEvent = event()) {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.event.set(ev);
    await fixture.whenStable();
    return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('should_render_actor_action_project_and_mr_link', async () => {
    const { el } = await setup();
    expect(el.querySelector('.actor')?.textContent).toContain('Marie Dupont');
    expect(el.querySelector('.sentence')?.textContent).toContain(t('history.actions.approved'));
    expect(el.querySelector('.tag')?.textContent).toContain('api');
    const link = el.querySelector<HTMLAnchorElement>('.mr-link')!;
    expect(link.getAttribute('href')).toBe('https://gitlab.com/equipe/api/-/merge_requests/12');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.textContent).toContain('#12 Corriger le tri');
  });

  it('should_use_the_success_tone_for_an_approval', async () => {
    const { el } = await setup();
    expect(el.querySelector('.marker')?.classList).toContain('success');
  });

  it('should_use_the_accent_tone_for_a_closure', async () => {
    const { el } = await setup(event({ type: 'closed' }));
    expect(el.querySelector('.marker')?.classList).toContain('accent');
  });

  it('should_show_a_dashed_placeholder_and_unknown_label_when_actor_is_unknown', async () => {
    const { el } = await setup(event({ actor: null }));
    expect(el.querySelector('app-avatar')).toBeNull();
    expect(el.querySelector('.unknown-avatar')).not.toBeNull();
    expect(el.querySelector('.actor')?.textContent).toContain(t('history.unknownActor'));
  });

  it('should_not_name_an_actor_for_a_disappeared_mr', async () => {
    const { el } = await setup(event({ type: 'disappeared', actor: null }));
    expect(el.querySelector('.actor')).toBeNull();
    expect(el.querySelector('.sentence')?.textContent).toContain(t('history.actions.disappeared'));
  });

  it('should_show_old_and_new_title', async () => {
    const { el } = await setup(event({ type: 'title_changed', oldValue: 'Avant', newValue: 'Après' }));
    expect(el.querySelector('.detail .old')?.textContent).toBe('Avant');
    expect(el.querySelector('.detail .new')?.textContent).toBe('Après');
  });

  it('should_quote_a_comment', async () => {
    const { el } = await setup(event({ type: 'commented', newValue: 'Super travail' }));
    expect(el.querySelector('blockquote.quote')?.textContent).toBe('Super travail');
  });

  it('should_apply_the_project_tag_style', async () => {
    const { fixture, host, el } = await setup();
    host.tagStyle.set({ background: 'rgb(1, 2, 3)', color: 'rgb(4, 5, 6)' });
    await fixture.whenStable();
    const tag = el.querySelector<HTMLElement>('.tag')!;
    expect(tag.style.backgroundColor).toBe('rgb(1, 2, 3)');
    expect(tag.classList).not.toContain('tag-neutral');
  });
});

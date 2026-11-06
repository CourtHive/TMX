import { getScheduleAnnotationLabels, getScheduleCellConfig } from './scheduleAnnotationLabels';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { i18next } from 'i18n';

vi.mock('courthive-components', () => ({
  DEFAULT_SCHEDULE_CELL_CONFIG: { header: ['time'], body: ['participants'], footer: [] },
}));

const modifiers = ['NOT_BEFORE', 'FOLLOWED_BY', 'NEXT_AVAILABLE', 'AFTER_REST', 'TO_BE_ANNOUNCED', 'RAIN_DELAY'];

afterEach(async () => {
  await i18next.changeLanguage('en');
});

describe('schedule annotation labels', () => {
  it('has real English keys for every supported modifier and uses compact NB/TBA', () => {
    const labels = getScheduleAnnotationLabels();
    expect(Object.keys(labels)).toEqual(modifiers);
    expect(labels.NOT_BEFORE).toEqual({ label: 'Not Before', short: 'NB' });
    expect(labels.TO_BE_ANNOUNCED).toEqual({ label: 'To be announced', short: 'TBA' });
    for (const { label, short } of Object.values(labels)) {
      expect(label).not.toMatch(/schedule\.|_/);
      expect(short).not.toMatch(/schedule\.|_/);
    }
    expect(getScheduleCellConfig().timeModifierLabels).toEqual(labels);
  });

  it('resolves a new locale at render time and falls back to English for an older locale bundle', async () => {
    i18next.addResourceBundle(
      'fr',
      'translation',
      {
        schedule: { timeModifiers: { NOT_BEFORE: { label: 'Pas avant', short: 'Pas avant' } } },
      },
      true,
      true,
    );
    await i18next.changeLanguage('fr');
    expect(getScheduleCellConfig().timeModifierLabels.NOT_BEFORE.short).toBe('Pas avant');
    expect(getScheduleAnnotationLabels().TO_BE_ANNOUNCED.short).toBe('TBA');
    await i18next.changeLanguage('en');
    expect(getScheduleCellConfig().timeModifierLabels.NOT_BEFORE.short).toBe('NB');
  });
});

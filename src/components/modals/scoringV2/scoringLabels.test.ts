import { describe, expect, it, vi } from 'vitest';
import sourceEnglish from 'i18n/locales/en.json';

vi.mock('i18n', async () => {
  const { default: i18next } = await import('i18next');
  const instance = i18next.createInstance();
  await instance.init({
    lng: 'fr',
    fallbackLng: false,
    resources: {
      fr: {
        translation: {
          modals: {
            scoring: {
              deadRubber: 'Match sans enjeu',
              challenged: 'Défi',
              statusUnavailable: '{{status}} indisponible pour ce match',
            },
          },
        },
      },
    },
    interpolation: { escapeValue: false },
  });
  return { t: instance.t.bind(instance) };
});

import { getScoringLabels, getScoreEntryLabels } from './scoringLabels';

const DEAD_LABEL = 'Match sans enjeu';
const TEMPLATE = '{{status}} indisponible pour ce match';

describe('scoring labels', () => {
  it('supplies translated status names and the refusal template to both dialogs', () => {
    expect(getScoringLabels()).toMatchObject({
      deadRubber: DEAD_LABEL,
      challenged: 'Défi',
      statusUnavailable: TEMPLATE,
    });
    expect(getScoreEntryLabels()).toMatchObject({
      DEAD_RUBBER: DEAD_LABEL,
      CHALLENGED: 'Défi',
      statusUnavailable: TEMPLATE,
    });
  });
  it('declares real source keys for the scope template and refusal toast', () => {
    expect(sourceEnglish.modals.scoring.statusUnavailable).toContain('{{status}}');
    expect(sourceEnglish.toasts.statusOutOfScope).toBe('This status is unavailable for this match');
  });
});

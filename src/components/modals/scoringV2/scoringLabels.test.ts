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
            scoreEntry: {
              submit: 'Valider',
              sidePanelHead: 'Que s’est-il passé pour {{name}} ?',
            },
          },
        },
      },
    },
    interpolation: { escapeValue: false },
  });
  return { t: instance.t.bind(instance) };
});

import { getScoreEntryLabels } from './scoringLabels';

const DEAD_LABEL = 'Match sans enjeu';
const TEMPLATE = '{{status}} indisponible pour ce match';

describe('score entry labels', () => {
  it('supplies translated status names and the refusal template', () => {
    expect(getScoreEntryLabels()).toMatchObject({
      DEAD_RUBBER: DEAD_LABEL,
      CHALLENGED: 'Défi',
      statusUnavailable: TEMPLATE,
    });
  });

  it("supplies the dialog's own words, with their placeholders left for the dialog to fill", () => {
    const labels = getScoreEntryLabels();
    expect(labels.submit).toBe('Valider');
    // Unfilled: the dialog knows the participant's name, TMX does not.
    expect(labels.sidePanelHead).toBe('Que s’est-il passé pour {{name}} ?');
  });

  it('asks for every key in modals.scoreEntry, so a key added there reaches the dialog', () => {
    const labels = getScoreEntryLabels();
    const keys = Object.keys(sourceEnglish.modals.scoreEntry);
    // CONTROL: the list is the dialog's whole vocabulary, not a stub.
    expect(keys.length).toBeGreaterThan(50);
    for (const key of keys) expect(labels, key).toHaveProperty(key);
  });

  it('declares real source keys for the scope template and refusal toast', () => {
    expect(sourceEnglish.modals.scoring.statusUnavailable).toContain('{{status}}');
    expect(sourceEnglish.toasts.statusOutOfScope).toBe('This status is unavailable for this match');
  });

  it('carries the placeholders the dialog fills, in the source English', () => {
    const entry: Record<string, string> = sourceEnglish.modals.scoreEntry;
    expect(entry.sidePanelHead).toContain('{{name}}');
    expect(entry.setPrefix).toContain('{{ordinal}}');
    expect(entry.defeated).toMatch(/{{winner}}.*{{loser}}.*{{score}}/);
  });
});

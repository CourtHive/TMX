/**
 * The legend's job is to have an entry for every mark the page can show, and to
 * name each one in the words the page actually uses. These tests hold it to
 * both — the sample text must come from the SAME i18n keys the real marks are
 * rendered from, so a reworded badge cannot leave a stale sample behind here.
 *
 * Content only. The nodes are built in `buildSchedulePopoverLegend`, and TMX
 * covers DOM construction in Playwright rather than a simulated document.
 */
import { legendSections } from './scheduleLegend';
import { describe, expect, it } from 'vitest';
import { t } from 'i18n';

const rows = () => legendSections().flatMap((section) => section.rows);
const samples = () => rows().map((row) => row.sample);

describe('the schedule legend explains the badge vocabulary', () => {
  it.each([['schedule.card.rest.onCourt'], ['schedule.card.rest.unknown'], ['schedule.card.rest.none']])(
    'carries the real %s badge text as a sample',
    (key) => {
      expect(samples()).toContain(t(key));
    },
  );

  it('carries the daily-limit marker in the form the badge renders it', () => {
    expect(samples()).toContain(t('schedule.card.rest.limit', { ordinal: 3 }));
  });

  it('carries the discarded-rung line in the form the Inspector renders it', () => {
    const rung = t('schedule.inspector.rest.discardedName.scoredTime');
    expect(samples()).toContain(t('schedule.inspector.rest.discarded', { rungs: rung }));
  });

  it('explains every sample it carries', () => {
    // A row with a sample and no meaning is a mark named but not explained,
    // which is the failure this affordance exists to prevent.
    expect(rows().length).toBeGreaterThanOrEqual(9);
    for (const row of rows()) {
      expect(row.sample.trim()).toBeTruthy();
      expect(row.meaning.trim()).toBeTruthy();
    }
  });

  it('gives every section a heading and at least one row', () => {
    const sections = legendSections();
    expect(sections.length).toBeGreaterThanOrEqual(3);
    for (const section of sections) {
      expect(section.heading.trim()).toBeTruthy();
      expect(section.rows.length).toBeGreaterThan(0);
    }
  });

  it('renders no untranslated key paths', () => {
    // `t()` echoes the key when it resolves to nothing, so a missing entry would
    // show the operator a dotted path.
    const text = legendSections()
      .flatMap((section) => [section.heading, ...section.rows.flatMap((row) => [row.sample, row.meaning])])
      .join(' ');
    expect(text).not.toMatch(/schedule\.legend\.|checkIn\./);
  });
});

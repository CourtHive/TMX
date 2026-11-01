import { getSettingsLayout, isLinkedTournamentsEligible, SETTINGS_GRID_COLUMNS } from './settingsLayout';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { isPipelineEligible } from 'services/pipeline/pipelineFeatures';
import { describe, expect, it } from 'vitest';

import type { SettingsLayoutRow } from './settingsLayout';

const ids = (rows: SettingsLayoutRow[]) => rows.map((row) => row.map(({ id }) => id));

describe('getSettingsLayout', () => {
  it('tournament scope: seeding, preferences row, pipeline, then Beta beside Danger Zone', () => {
    const rows = getSettingsLayout({ pipelineEligible: true, canDeleteTournament: true });
    expect(ids(rows)).toEqual([
      ['seedingPolicy'],
      ['language', 'theme', 'font', 'options'],
      ['pipelineFeatures'],
      ['betaFeatures', 'dangerZone'],
    ]);
  });

  it('puts Theme, Font and Options on the same row, and Pipeline features in the row below it', () => {
    const rows = ids(getSettingsLayout({ pipelineEligible: true, canDeleteTournament: true }));
    const preferencesRow = rows.findIndex((row) => row.includes('theme'));
    expect(rows[preferencesRow]).toEqual(expect.arrayContaining(['theme', 'font', 'options']));
    expect(rows[preferencesRow + 1]).toEqual(['pipelineFeatures']);
  });

  it('every row fills the grid exactly, so a full-width panel never splits the column grid', () => {
    const variants = [true, false].flatMap((excludeTournament) =>
      [true, false].flatMap((pipelineEligible) =>
        [true, false].flatMap((canDeleteTournament) =>
          [true, false].map((isElectron) => ({ excludeTournament, pipelineEligible, canDeleteTournament, isElectron })),
        ),
      ),
    );
    for (const variant of variants) {
      for (const row of getSettingsLayout(variant)) {
        expect(row.reduce((sum, { span }) => sum + span, 0)).toBe(SETTINGS_GRID_COLUMNS);
        for (const { span } of row) expect(Number.isInteger(span)).toBe(true);
      }
    }
  });

  it('the scoring approach panel is gone in every scope', () => {
    for (const excludeTournament of [true, false]) {
      const all = ids(
        getSettingsLayout({ excludeTournament, pipelineEligible: true, canDeleteTournament: true }),
      ).flat();
      expect(all).not.toContain('scoringApproach');
    }
  });

  it('app scope leaves out every tournament-scoped panel, even when the inputs would allow them', () => {
    const rows = getSettingsLayout({ excludeTournament: true, pipelineEligible: true, canDeleteTournament: true });
    expect(ids(rows)).toEqual([['language', 'theme', 'font', 'options'], ['betaFeatures']]);
  });

  it('without delete permission Beta features fills its row alone', () => {
    const rows = getSettingsLayout({ canDeleteTournament: false });
    expect(rows.at(-1)).toEqual([{ id: 'betaFeatures', span: SETTINGS_GRID_COLUMNS }]);
  });

  it('Electron adds the connection panel between Beta features and Danger Zone', () => {
    const rows = getSettingsLayout({ canDeleteTournament: true, isElectron: true });
    expect(ids(rows).at(-1)).toEqual(['betaFeatures', 'connection', 'dangerZone']);
  });

  it('preferences row panels share the grid evenly', () => {
    const [, preferences] = getSettingsLayout({});
    expect(preferences.map(({ span }) => span)).toEqual([3, 3, 3, 3]);
  });
});

describe('pipeline features placement, from a real tournament record', () => {
  const loadMock = () => {
    const { tournamentRecord } = mocksEngine.generateTournamentRecord({ setState: true });
    return { ...tournamentEngine.getTournament().tournamentRecord, isMock: tournamentRecord?.isMock };
  };

  it('shows for a logged-out user and is never shown on the app screen', () => {
    const record = loadMock();
    const pipelineEligible = isPipelineEligible(record, false);
    expect(pipelineEligible).toBe(true);
    expect(ids(getSettingsLayout({ pipelineEligible })).flat()).toContain('pipelineFeatures');
    expect(ids(getSettingsLayout({ pipelineEligible, excludeTournament: true })).flat()).not.toContain(
      'pipelineFeatures',
    );
  });

  it('is left out for a logged-in user on a tournament that is not a mock', () => {
    const record = { ...loadMock(), isMock: false };
    const pipelineEligible = isPipelineEligible(record, true);
    expect(pipelineEligible).toBe(false);
    expect(ids(getSettingsLayout({ pipelineEligible })).flat()).not.toContain('pipelineFeatures');
  });
});

describe('isLinkedTournamentsEligible', () => {
  it('needs a tournament and a logged-in user', () => {
    expect(isLinkedTournamentsEligible({ loggedIn: true })).toBe(true);
    expect(isLinkedTournamentsEligible({ loggedIn: false })).toBe(false);
    expect(isLinkedTournamentsEligible({ excludeTournament: true, loggedIn: true })).toBe(false);
  });
});

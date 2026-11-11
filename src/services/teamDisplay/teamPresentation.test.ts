import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ extensions: [] as any[], mutationRequest: vi.fn() }));
vi.mock('services/factory/engine', () => ({
  tournamentEngine: {
    getTournament: () => ({ tournamentRecord: { extensions: state.extensions } }),
    getParticipants: () => ({ participants: [] }),
  },
}));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: state.mutationRequest }));
vi.mock('courthive-components', () => ({ cModal: {}, renderTeamPresentationEditor: vi.fn() }));
vi.mock('i18n', () => ({ t: (key: string) => key }));
import { displayExtensionWithTeamPresentation, teamPresentationLabels } from './teamPresentation';

describe('tournament team presentation', () => {
  it('replaces only teamPresentation and preserves every other DISPLAY extension key', () => {
    const existing = { compositionName: 'Scoreboard', scoreboard: { theme: 'dark' }, teamPresentation: { roles: {} } };
    const before = JSON.stringify(existing);
    const teamPresentation = { roles: { 'team.accent': '#13294B' } };
    expect(displayExtensionWithTeamPresentation(existing, teamPresentation)).toEqual({
      name: 'display',
      value: { compositionName: 'Scoreboard', scoreboard: { theme: 'dark' }, teamPresentation },
    });
    expect(JSON.stringify(existing)).toBe(before);
    expect(displayExtensionWithTeamPresentation(undefined, teamPresentation).value).toEqual({ teamPresentation });
  });

  it('supplies every label the components editor reads, with role captions shared with the palette editor', () => {
    const labels = teamPresentationLabels();
    for (const key of ['palette', 'choosePalette', 'missingTeam', 'missingColor', 'colorValue', 'paletteValue'])
      expect(labels[key]).toBe(`teamPresentation.${key}`);
    expect(labels['team.surface']).toBe('pages.participants.grouping.team.surface');
    expect(labels['score.text']).toBe('pages.participants.grouping.score.text');
    expect(labels).not.toHaveProperty('reference');
  });
});

import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ get: vi.fn(), participants: [] as any[], tournamentId: 'one' }));
vi.mock('services/apis/baseApi', () => ({ baseApi: { get: state.get } }));
vi.mock('services/factory/engine', () => ({
  tournamentEngine: {
    getParticipants: () => ({ participants: state.participants }),
    getTournament: () => ({ tournamentRecord: { tournamentId: state.tournamentId } }),
  },
}));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: vi.fn() }));
vi.mock('courthive-components', async () => ({ ...(await import('courthive-components/team-colors')), cModal: {} }));
vi.mock('i18n', () => ({ t: (key: string) => key }));
import { providerTeamMethods } from './importProviderTeams';

const colors = { palette: [{ colorId: 'navy', value: '#13294B' }], display: { roles: { 'team.surface': 'navy' } } };
beforeEach(() => {
  state.get.mockReset();
  state.participants = [];
  state.tournamentId = 'one';
});
it('imports dozens of provider-default teams in one mutation batch with no presentation setup', async () => {
  const ids = Array.from({ length: 48 }, (_, index) => `college-${index}`);
  state.get.mockImplementation((path: string) =>
    Promise.resolve({
      data: { participant: { participantId: path.split('/').at(-2), participantType: 'TEAM', teamColors: colors } },
    }),
  );
  const methods = await providerTeamMethods([...ids, ids[0]]);
  expect(state.get).toHaveBeenCalledTimes(48);
  expect(methods).toHaveLength(1);
  expect(methods[0].method).toBe('addParticipants');
  expect(methods[0].params.participants).toHaveLength(48);
  expect(methods[0].params.participants.every((team: any) => team.teamColors === colors)).toBe(true);
});
it('refreshes only default branding and preserves local roster and presentation ownership', async () => {
  state.participants = [{ participantId: 'alpha', participantType: 'TEAM', individualParticipantIds: ['player'] }];
  state.get.mockResolvedValue({ data: { participant: { participantId: 'alpha', participantType: 'TEAM' } } });
  expect(await providerTeamMethods(['alpha'])).toEqual([
    { method: 'modifyParticipant', params: { participant: { participantId: 'alpha', teamColors: {} } } },
  ]);
  expect(state.participants[0].individualParticipantIds).toEqual(['player']);
});
it('rejects a failed/mismatched provider response before returning any mutation batch', async () => {
  state.get
    .mockResolvedValueOnce({ data: { participant: { participantId: 'alpha', participantType: 'TEAM' } } })
    .mockRejectedValueOnce(new Error('Provider unavailable'));
  await expect(providerTeamMethods(['alpha', 'beta'])).rejects.toThrow('Provider unavailable');
  state.get.mockResolvedValue({ data: { participant: { participantId: 'other', participantType: 'TEAM' } } });
  await expect(providerTeamMethods(['alpha'])).rejects.toThrow();
});

it('refuses a provider response after the active tournament changes', async () => {
  let release: (value: any) => void = () => {};
  state.get.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const pending = providerTeamMethods(['alpha']);
  state.tournamentId = 'two';
  release({ data: { participant: { participantId: 'alpha', participantType: 'TEAM' } } });
  await expect(pending).rejects.toThrow('teamPresentation.tournamentChanged');
});

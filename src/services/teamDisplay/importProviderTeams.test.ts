import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  get: vi.fn(),
  participants: [] as any[],
  tournamentId: 'one',
  mutationRequest: vi.fn(),
}));
vi.mock('services/apis/baseApi', () => ({ baseApi: { get: state.get } }));
vi.mock('services/factory/engine', () => ({
  tournamentEngine: {
    getParticipants: () => ({ participants: state.participants }),
    getTournament: () => ({ tournamentRecord: { tournamentId: state.tournamentId } }),
  },
}));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: state.mutationRequest }));
vi.mock('courthive-components', async () => ({
  ...(await import('courthive-components/team-colors')),
  cModal: {},
}));
vi.mock('i18n', () => ({ t: (key: string) => key }));
import { providerTeamMethods, providerTeamSaver } from './importProviderTeams';

const colors = { palette: [{ colorId: 'navy', value: '#13294B' }], display: { roles: { 'team.surface': 'navy' } } };
beforeEach(() => {
  state.get.mockReset();
  state.mutationRequest.mockReset();
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
  state.get.mockResolvedValue({
    data: {
      participant: { participantId: 'alpha', participantType: 'TEAM', participantName: 'Renamed', teamColors: colors },
    },
  });
  expect(await providerTeamMethods(['alpha'])).toEqual([
    { method: 'modifyParticipant', params: { participant: { participantId: 'alpha', teamColors: colors } } },
  ]);
  expect(state.participants[0].individualParticipantIds).toEqual(['player']);
});
it('leaves an existing team palette untouched when the provider publishes no teamColors', async () => {
  state.participants = [{ participantId: 'alpha', participantType: 'TEAM', teamColors: colors }];
  state.get.mockResolvedValue({ data: { participant: { participantId: 'alpha', participantType: 'TEAM' } } });
  expect(await providerTeamMethods(['alpha'])).toEqual([]);
});
it('adds only identity and branding fields from the provider record', async () => {
  state.get.mockResolvedValue({
    data: {
      participant: {
        participantId: 'alpha',
        participantType: 'TEAM',
        participantRole: 'COMPETITOR',
        participantName: 'Alpha',
        teamColors: colors,
        individualParticipantIds: ['provider-player'],
        timeItems: [{ itemType: 'PROVIDER' }],
        extensions: [{ name: 'provider', value: {} }],
      },
    },
  });
  const [method] = await providerTeamMethods(['alpha']);
  expect(method.params.participants).toEqual([
    {
      participantId: 'alpha',
      participantName: 'Alpha',
      participantType: 'TEAM',
      participantRole: 'COMPETITOR',
      teamColors: colors,
    },
  ]);
});
it('releases the save guard on every outcome, including a request that throws instead of calling back', async () => {
  state.get.mockResolvedValue({ data: { participant: { participantId: 'alpha', participantType: 'TEAM' } } });
  const onError = vi.fn();
  const onSuccess = vi.fn();
  const save = providerTeamSaver({ isClosed: () => false, onSuccess, onError });
  state.mutationRequest.mockRejectedValueOnce(new Error('offline'));
  await save(['alpha']);
  expect(onError).toHaveBeenLastCalledWith('offline');
  state.mutationRequest.mockImplementationOnce(({ callback }: any) => callback({ error: { message: 'timeout' } }));
  await save(['alpha']);
  expect(onError).toHaveBeenLastCalledWith('timeout');
  state.mutationRequest.mockImplementationOnce(({ callback }: any) => callback({ success: true }));
  await save(['alpha']);
  expect(state.mutationRequest).toHaveBeenCalledTimes(3);
  expect(onSuccess).toHaveBeenCalledTimes(1);
});
it('refuses a second save while the first is still awaiting its mutation callback', async () => {
  state.get.mockResolvedValue({ data: { participant: { participantId: 'alpha', participantType: 'TEAM' } } });
  const save = providerTeamSaver({ isClosed: () => false, onSuccess: vi.fn(), onError: vi.fn() });
  state.mutationRequest.mockResolvedValue(undefined);
  await save(['alpha']);
  await save(['alpha']);
  expect(state.mutationRequest).toHaveBeenCalledTimes(1);
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

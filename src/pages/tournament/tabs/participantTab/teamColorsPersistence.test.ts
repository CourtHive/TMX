import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { beforeEach, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  branding: undefined as any,
  mutation: vi.fn(),
  open: vi.fn(),
  form: vi.fn(),
  buttons: vi.fn(),
}));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: h.mutation }));
vi.mock('./teamPaletteEditor', () => ({ renderTeamPaletteEditor: () => ({ read: () => h.branding }) }));
vi.mock('services/context', () => ({ context: { drawer: { open: h.open } } }));
vi.mock('courthive-components', () => ({
  renderForm: h.form,
  renderButtons: h.buttons,
  validators: { nameValidator: () => () => true },
}));

import { editGroupingParticipant } from './editGroupingParticipant';

function save(participant: any, branding: any) {
  h.branding = branding;
  h.form.mockReturnValue({
    participantName: { value: 'Branded team' },
  });
  editGroupingParticipant({ participantType: 'TEAM', participant });
  const config = h.open.mock.calls.at(-1)?.[0];
  config.content({});
  config.footer({}, vi.fn());
  h.buttons.mock.calls
    .at(-1)?.[1]
    .find((button: any) => button.label === 'Save')
    .onClick();
  const methods = h.mutation.mock.calls.at(-1)?.[0].methods;
  let result: any = tournamentEngine.executionQueue(methods, true);
  expect(result.error).toBeUndefined();
  // Exercise the JSON persistence boundary between editor sessions.
  const serialized = JSON.stringify(tournamentEngine.getTournament().tournamentRecord);
  tournamentEngine.setState(JSON.parse(serialized));
  const saved = tournamentEngine.getParticipants().participants?.find((p: any) => p.participantName === 'Branded team');
  if (!saved) throw new Error('Editor mutation did not persist the TEAM participant');
  return saved;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocksEngine.generateTournamentRecord({ setState: true, nonRandom: 1 });
});

it('creates, reloads, replaces and clears the full CODES palette through editor requests and the real factory', () => {
  const palette = ['red', 'white', 'black', 'gold'].map((colorId, index) => ({
    colorId,
    value: ['#ce1126', '#ffffff', '#000000', '#fcd116'][index],
    group: 'Primary',
  }));
  const created = save(undefined, { palette, display: { roles: { 'team.accent': 'red', 'team.surface': 'gold' } } });
  expect(created.teamColors?.palette).toHaveLength(4);
  expect(created.teamColors?.palette.every((entry) => entry.group === 'Primary')).toBe(true);
  const replaced = save(created, { palette: [...palette].reverse(), display: { roles: { 'team.accent': 'gold' } } });
  expect(replaced.teamColors?.palette).toHaveLength(4);
  expect(replaced.teamColors?.palette[0].colorId).toBe('gold');
  expect(replaced.teamColors?.display).toEqual({ roles: { 'team.accent': 'gold' } });
  const cleared = save(replaced, {});
  expect(cleared).not.toHaveProperty('teamColors');
});

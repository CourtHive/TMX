import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { beforeEach, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  mutation: vi.fn(),
  open: vi.fn(),
  form: vi.fn(),
  buttons: vi.fn(),
}));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: h.mutation }));
vi.mock('services/context', () => ({ context: { drawer: { open: h.open } } }));
vi.mock('courthive-components', () => ({
  renderForm: h.form,
  renderButtons: h.buttons,
  validators: { nameValidator: () => () => true },
}));

import { editGroupingParticipant } from './editGroupingParticipant';

function save(participant: any, primary: string, secondary = '') {
  h.form.mockReturnValue({
    participantName: { value: 'Branded team' },
    teamColorprimary: { value: primary },
    teamColorsecondary: { value: secondary },
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

it('creates, reloads, replaces and clears branding through editor requests and the real factory', () => {
  const created = save(undefined, '#aabbcc', '#112233');
  expect(created.teamColors).toEqual({ primary: '#AABBCC', secondary: '#112233' });
  const replaced = save(created, '#ffeedd');
  expect(replaced.teamColors).toEqual({ primary: '#FFEEDD' });
  const cleared = save(replaced, '');
  expect(cleared).not.toHaveProperty('teamColors');
});

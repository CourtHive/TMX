import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  mutation: vi.fn(),
  open: vi.fn(),
  form: vi.fn(),
  buttons: vi.fn(),
  branding: undefined as any,
}));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: h.mutation }));
vi.mock('services/context', () => ({ context: { drawer: { open: h.open } } }));
vi.mock('./teamPaletteEditor', () => ({ renderTeamPaletteEditor: () => ({ read: () => h.branding }) }));
vi.mock('courthive-components', () => ({
  renderForm: h.form,
  renderButtons: h.buttons,
  validators: { nameValidator: () => () => true },
}));
import { editGroupingParticipant } from './editGroupingParticipant';

const colors = {
  palette: [
    { colorId: 'red', value: '#CE1126', group: 'Primary' },
    { colorId: 'white', value: '#FFFFFF', group: 'Primary' },
    { colorId: 'gold', value: '#FCD116' },
  ],
  display: { roles: { 'team.accent': 'red', 'team.surface': 'gold' } },
};
function edit(participant: any, branding: any, participantType = 'TEAM') {
  h.branding = branding;
  h.form.mockReturnValue({ participantName: { value: 'Team Alpha' } });
  editGroupingParticipant({ participant, participantType });
  const drawer = h.open.mock.calls.at(-1)?.[0];
  drawer.content({});
  drawer.footer({}, vi.fn());
  h.buttons.mock.calls
    .at(-1)?.[1]
    .find((button: any) => button.label === 'Save')
    .onClick();
  return h.mutation.mock.calls.at(-1)?.[0].methods[0];
}
beforeEach(() => vi.clearAllMocks());
describe('CODES TEAM palette producer', () => {
  it('creates through addParticipants without discarding unselected colors or groups', () => {
    const method = edit(undefined, colors);
    expect(method.method).toBe('addParticipants');
    expect(method.params.participants[0].teamColors).toEqual(colors);
  });
  it('replaces through modifyParticipant with a complete canonical palette', () => {
    const method = edit(
      { participantId: 'team', teamColors: colors },
      { ...colors, display: { roles: { 'team.accent': 'gold' } } },
    );
    expect(method.method).toBe('modifyParticipant');
    expect(method.params.participant.teamColors.palette).toEqual(colors.palette);
    expect(method.params.participant.teamColors.display).toEqual({ roles: { 'team.accent': 'gold' } });
  });
  it('clears with an explicit empty object', () => {
    expect(edit({ participantId: 'team' }, {}).params.participant.teamColors).toEqual({});
  });
  it('keeps invalid palette edits open without dispatching', () => {
    expect(edit({ participantId: 'team' }, undefined)).toBeUndefined();
    expect(h.mutation).not.toHaveBeenCalled();
  });
  it('offers no branding mutation for GROUP', () => {
    expect(edit({ participantId: 'group' }, colors, 'GROUP').params.participant).not.toHaveProperty('teamColors');
  });
});

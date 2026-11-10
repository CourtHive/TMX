import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function edit(participant: any, primary: string, secondary = '', participantType = 'TEAM') {
  h.form.mockReturnValue({
    participantName: { value: 'Team Alpha' },
    teamColorprimary: { value: primary, setCustomValidity: vi.fn(), reportValidity: vi.fn() },
    teamColorsecondary: { value: secondary },
  });
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

describe('TEAM branding producer', () => {
  it('creates through addParticipants with canonical colors', () => {
    const method = edit(undefined, '#aabbcc', '#112233');
    expect(method.method).toBe('addParticipants');
    expect(method.params.participants[0].teamColors).toEqual({ primary: '#AABBCC', secondary: '#112233' });
  });
  it('loads and replaces through modifyParticipant, removing an omitted secondary', () => {
    const participant = { participantId: 'team', teamColors: { primary: '#112233', secondary: '#aabbcc' } };
    const method = edit(participant, '#ffffff');
    expect(method.method).toBe('modifyParticipant');
    expect(method.params.participant.teamColors).toEqual({ primary: '#FFFFFF' });
    const fields = h.form.mock.calls.at(-1)?.[1];
    expect(fields.find((field: any) => field.field === 'teamColorsecondary').value).toBe('#aabbcc');
  });
  it('clears with an explicit empty object', () => {
    expect(edit({ participantId: 'team' }, '').params.participant.teamColors).toEqual({});
  });
  it.each([
    ['red', ''],
    ['', '#ffffff'],
    ['#ffffff', '#bad'],
  ])('refuses invalid primary=%s secondary=%s before dispatch', (primary, secondary) => {
    expect(edit({ participantId: 'team' }, primary, secondary)).toBeUndefined();
    expect(h.mutation).not.toHaveBeenCalled();
  });
  it('offers no branding fields or mutation for GROUP', () => {
    const method = edit({ participantId: 'group' }, '#ffffff', '', 'GROUP');
    expect(method.params.participant).not.toHaveProperty('teamColors');
    expect(h.form.mock.calls.at(-1)?.[1].some((field: any) => field.field.startsWith('teamColor'))).toBe(false);
  });
});

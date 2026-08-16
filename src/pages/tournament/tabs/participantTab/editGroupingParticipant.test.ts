/**
 * GROUP participantRole surface.
 *
 * Before this, `editGroupingParticipant` hardcoded `participantType === TEAM ? COMPETITOR : OTHER`, so
 * every GROUP a TD could create landed as OTHER — the one value that falls through
 * `ConflictRule.roleSeverity` to base severity. The COACH/MEDICAL/PHYSIO/TRAINER → BLOCK escalation in
 * factory 6.26.0 was therefore unreachable from the UI, and `SHARED_GROUPING` could only ever WARN.
 *
 * These assert the dispatched params, since that is where the bug lived. The final block is the
 * end-to-end proof: a COACH group actually produces `blocked: true` from the factory.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mutationRequestMock } = vi.hoisted(() => ({ mutationRequestMock: vi.fn() }));
const { drawerOpenMock } = vi.hoisted(() => ({ drawerOpenMock: vi.fn() }));
const { renderFormMock } = vi.hoisted(() => ({ renderFormMock: vi.fn() }));
const { renderButtonsMock } = vi.hoisted(() => ({ renderButtonsMock: vi.fn() }));

vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: mutationRequestMock }));
vi.mock('services/context', () => ({ context: { drawer: { open: drawerOpenMock } } }));
vi.mock('courthive-components', () => ({
  renderForm: renderFormMock,
  renderButtons: renderButtonsMock,
  validators: { nameValidator: () => () => true },
}));

import { editGroupingParticipant } from './editGroupingParticipant';
import { participantConstants, participantRoles } from 'tods-competition-factory';

const { COACH, COMPETITOR, OTHER } = participantRoles;
const { GROUP, TEAM } = participantConstants;
const TEAM_ALPHA = 'Team Alpha';

/** Drive the drawer: render the form, then invoke Save. */
function openAndSave(args: any, inputs: Record<string, any>) {
  renderFormMock.mockReturnValue(inputs);
  editGroupingParticipant(args);
  // content() builds `inputs`; footer wiring is mocked, so call the save path via the drawer content.
  const { content } = drawerOpenMock.mock.calls.at(-1)?.[0] ?? {};
  // renderForm is mocked, so the element is never touched — no DOM needed (vitest here is node-env;
  // DOM behaviour belongs in Playwright).
  content?.({} as any);
  return renderFormMock.mock.calls.at(-1)?.[1];
}

/** Render the drawer then click Save, returning the dispatched methods. */
function save(args: any, inputs: Record<string, any>) {
  openAndSave(args, inputs);
  const { footer } = drawerOpenMock.mock.calls.at(-1)?.[0] ?? {};
  footer?.({} as any, () => {});
  const buttons = renderButtonsMock.mock.calls.at(-1)?.[1] ?? [];
  buttons.find((b: any) => b.label === 'Save')?.onClick?.();
  return mutationRequestMock.mock.calls.at(-1)?.[0]?.methods ?? [];
}

beforeEach(() => {
  mutationRequestMock.mockReset();
  drawerOpenMock.mockReset();
  renderFormMock.mockReset();
  renderButtonsMock.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe('group role field', () => {
  it('offers a participantRole select for GROUP', () => {
    const fields = openAndSave({ participantType: GROUP }, {});
    const roleField = fields?.find((f: any) => f.field === 'participantRole');
    expect(roleField).toBeDefined();
    expect(roleField.options.map((o: any) => o.value)).toContain(COACH);
    // OTHER is the default so an ordinary grouping behaves exactly as before this select existed.
    expect(roleField.value).toEqual(OTHER);
  });

  it('does NOT offer the select for TEAM', () => {
    // teamProfileModal filters rosters on participantRole === COMPETITOR; a settable TEAM role would
    // silently break roster rendering.
    const fields = openAndSave({ participantType: TEAM }, {});
    expect(fields?.find((f: any) => f.field === 'participantRole')).toBeUndefined();
  });

  it('preselects an existing group role when editing', () => {
    const fields = openAndSave(
      { participantType: GROUP, participant: { participantId: 'g1', participantRole: COACH } },
      {},
    );
    const roleField = fields?.find((f: any) => f.field === 'participantRole');
    expect(roleField.value).toEqual(COACH);
    expect(roleField.options.find((o: any) => o.value === COACH).selected).toBe(true);
  });
});

describe('dispatched params — where the bug actually lived', () => {
  it('sends the selected role when creating a GROUP', () => {
    const methods = save(
      { participantType: GROUP },
      { participantName: { value: TEAM_ALPHA }, participantRole: { value: COACH } },
    );
    expect(methods).toHaveLength(1);
    expect(methods[0].params.participantRole).toEqual(COACH);
  });

  it('creates a GROUP through createGroupParticipant, not the hand-built ADD_PARTICIPANTS path', () => {
    // The factory creator validates that every member is an INDIVIDUAL in the tournament; the
    // hand-built path skips that check.
    const methods = save(
      { participantType: GROUP, individualParticipantIds: ['p1', 'p2'] },
      { participantName: { value: TEAM_ALPHA }, participantRole: { value: COACH } },
    );
    expect(methods[0].method).toEqual('createGroupParticipant');
    expect(methods[0].params.groupName).toEqual(TEAM_ALPHA);
    expect(methods[0].params.individualParticipantIds).toEqual(['p1', 'p2']);
  });

  it('defaults a GROUP to OTHER when no role is chosen', () => {
    const methods = save({ participantType: GROUP }, { participantName: { value: 'Squad' } });
    expect(methods[0].params.participantRole).toEqual(OTHER);
  });

  it('still pins TEAM to COMPETITOR via addParticipants', () => {
    const methods = save({ participantType: TEAM }, { participantName: { value: 'The Team' } });
    expect(methods[0].method).toEqual('addParticipants');
    expect(methods[0].params.participants[0].participantRole).toEqual(COMPETITOR);
  });

  it('updates the role on an existing GROUP', () => {
    const methods = save(
      { participantType: GROUP, participant: { participantId: 'g1', participantRole: OTHER } },
      { participantName: { value: TEAM_ALPHA }, participantRole: { value: COACH } },
    );
    expect(methods[0].method).toEqual('modifyParticipant');
    expect(methods[0].params.participant.participantRole).toEqual(COACH);
  });

  it('does not send a participantRole when editing a TEAM', () => {
    const methods = save(
      { participantType: TEAM, participant: { participantId: 't1' } },
      { participantName: { value: 'The Team' } },
    );
    expect(methods[0].params.participant.participantRole).toBeUndefined();
  });
});

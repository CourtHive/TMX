/**
 * Staff creation.
 *
 * `editIndividualParticipant` hardcoded `participantRole: view === OFFICIAL ? OFFICIAL : COMPETITOR` at
 * the point of creation, with no Staff branch. So "New participant" from the Staff view created a
 * COMPETITOR — which the Staff view's own filter (`STAFF_ROLES`) then excluded. The row was created, it
 * vanished from the view that created it, and it joined the draw-eligible pool. A TD who assumed the save
 * had failed and typed the name again ended up with two phantom competitors.
 *
 * These assert the dispatched params, because that is where the bug lived. Mechanics copied from
 * `editGroupingParticipant.test.ts`.
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

import { editIndividualParticipant } from './editIndividualParticipant';
import { participantRoles } from 'tods-competition-factory';
import { STAFF_ROLES } from 'constants/staffRoles';
import { STAFF } from 'constants/tmxConstants';

const { COACH, COMPETITOR, OFFICIAL, PHYSIO, SCOREKEEPER, STRINGER } = participantRoles;

const NAME_INPUTS = {
  firstName: { value: 'Ana' },
  lastName: { value: 'Rivas' },
  nickname: { value: '' },
  sex: { value: '' },
  birthday: { value: '' },
  nationalityCode: { value: '' },
};

/** Render the drawer content and return the form field definitions. */
function openForm(args: any, inputs: Record<string, any>) {
  renderFormMock.mockReturnValue(inputs);
  editIndividualParticipant(args);
  const { content } = drawerOpenMock.mock.calls.at(-1)?.[0] ?? {};
  content?.({} as any);
  return renderFormMock.mock.calls.at(-1)?.[1];
}

/** Render the drawer then click Save, returning the dispatched methods. */
function save(args: any, inputs: Record<string, any>) {
  openForm(args, inputs);
  const { footer } = drawerOpenMock.mock.calls.at(-1)?.[0] ?? {};
  footer?.({} as any, () => {});
  const buttons = renderButtonsMock.mock.calls.at(-1)?.[1] ?? [];
  buttons.find((b: any) => b.intent === 'is-info')?.onClick?.();
  return mutationRequestMock.mock.calls.at(-1)?.[0]?.methods ?? [];
}

beforeEach(() => {
  mutationRequestMock.mockReset();
  drawerOpenMock.mockReset();
  renderFormMock.mockReset();
  renderButtonsMock.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe('staff role field', () => {
  it('offers a participantRole select in the Staff view', () => {
    const fields = openForm({ view: STAFF }, NAME_INPUTS);
    const roleField = fields?.find((f: any) => f.field === 'participantRole');
    expect(roleField).toBeDefined();
    expect(roleField.options.map((o: any) => o.value)).toEqual(expect.arrayContaining([COACH, PHYSIO, STRINGER]));
  });

  it('does NOT offer the select in the competitor or officials views', () => {
    // Each of those views maps to exactly one role. Offering a choice there would let a TD file a
    // participant into a view that its own filter then hides it behind — the bug this select closes.
    expect(
      openForm({ view: 'INDIVIDUAL' }, NAME_INPUTS)?.find((f: any) => f.field === 'participantRole'),
    ).toBeUndefined();
    expect(openForm({ view: OFFICIAL }, NAME_INPUTS)?.find((f: any) => f.field === 'participantRole')).toBeUndefined();
  });

  it('preselects an existing role when editing a staff member', () => {
    const fields = openForm(
      { view: STAFF, participant: { participantId: 's1', participantRole: PHYSIO } },
      NAME_INPUTS,
    );
    const roleField = fields?.find((f: any) => f.field === 'participantRole');
    expect(roleField.value).toEqual(PHYSIO);
    expect(roleField.options.find((o: any) => o.value === PHYSIO).selected).toBe(true);
  });
});

describe('dispatched params — where the bug actually lived', () => {
  it('sends the selected staff role when creating from the Staff view', () => {
    // THE regression test. Against the old code this received COMPETITOR.
    const methods = save({ view: STAFF }, { ...NAME_INPUTS, participantRole: { value: COACH } });
    expect(methods[0].method).toEqual('addParticipants');
    expect(methods[0].params.participants[0].participantRole).toEqual(COACH);
  });

  it('never creates a COMPETITOR from the Staff view', () => {
    // Stated as its own case because COMPETITOR is the specific value that made the row disappear:
    // the Staff filter excludes it, so the participant was created into a view that could not show it.
    const methods = save({ view: STAFF }, { ...NAME_INPUTS, participantRole: { value: STRINGER } });
    expect(methods[0].params.participants[0].participantRole).not.toEqual(COMPETITOR);
  });

  it('still creates a COMPETITOR from the individuals view', () => {
    const methods = save({ view: 'INDIVIDUAL' }, NAME_INPUTS);
    expect(methods[0].params.participants[0].participantRole).toEqual(COMPETITOR);
  });

  it('still creates an OFFICIAL from the officials view', () => {
    const methods = save({ view: OFFICIAL }, NAME_INPUTS);
    expect(methods[0].params.participants[0].participantRole).toEqual(OFFICIAL);
  });

  it('updates the role on an existing staff member', () => {
    const methods = save(
      { view: STAFF, participant: { participantId: 's1', participantRole: COACH } },
      { ...NAME_INPUTS, participantRole: { value: PHYSIO } },
    );
    expect(methods[0].method).toEqual('modifyParticipant');
    expect(methods[0].params.participant.participantRole).toEqual(PHYSIO);
  });

  it('does not send a participantRole when editing from a non-staff view', () => {
    // A competitor edited from the individuals view must not have a role written at all — sending one
    // would let an unrelated edit silently re-file the participant.
    const methods = save({ view: 'INDIVIDUAL', participant: { participantId: 'p1' } }, NAME_INPUTS);
    expect(methods[0].params.participant.participantRole).toBeUndefined();
  });
});

describe('STAFF_ROLES is derived, not hand-copied', () => {
  it('includes the two roles the hand-written list had silently dropped', () => {
    // SCOREKEEPER and TIMEKEEPER exist in the factory's `participantRoles` const module but not in
    // `ParticipantRoleEnum`. The old hard-coded list mirrored the enum, so a nominated crowd-scorer was
    // invisible in every participant view.
    expect(STAFF_ROLES).toContain(SCOREKEEPER);
    expect(STAFF_ROLES).toContain(participantRoles.TIMEKEEPER);
  });

  it('excludes COMPETITOR and OFFICIAL, which have their own views', () => {
    expect(STAFF_ROLES).not.toContain(COMPETITOR);
    expect(STAFF_ROLES).not.toContain(OFFICIAL);
  });

  it('leaves no factory role unreachable from some view', () => {
    // The invariant that actually broke, stated as a partition rather than by recomputing the filter:
    // every role the factory defines is reachable from exactly one of the three views. A role that is
    // in none of them is invisible everywhere, which is what happened to SCOREKEEPER and TIMEKEEPER.
    const reachable = new Set<string>([...STAFF_ROLES, COMPETITOR, OFFICIAL]);
    const unreachable = Object.values(participantRoles).filter((role) => !reachable.has(role));
    expect(unreachable).toEqual([]);
  });
});

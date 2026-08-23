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

/**
 * Contact details.
 *
 * TMX had no contact-entry UI at all — contacts arrived only via CSV/Sheets import — and
 * `person.contacts` had no factory write path until competition-factory#4680. Extended to EVERY
 * participant rather than staff alone (CA): a director needs to reach a competitor at least as urgently
 * as an official, an ALTERNATE who might get into the draw being the obvious case.
 *
 * The array handling is the dangerous part and gets the most coverage. `modifyParticipant` REPLACES
 * `person.contacts` rather than merging, so a drawer that edited the primary contact and dispatched only
 * that one would silently delete every other contact on an imported record.
 */
const NEW_MOBILE = '+1 555 0100';
const STORED_MOBILE = '+1 555 0000';
const OTHER_MOBILE = '+1 555 9999';
const EMERGENCY = 'emergency';

const CONTACT_INPUTS = {
  ...NAME_INPUTS,
  mobileTelephone: { value: NEW_MOBILE },
  emailAddress: { value: 'ana@example.org' },
  contactIsPublic: { checked: true },
};

const contactsFrom = (methods: any[]) => methods[0]?.params?.participant?.person?.contacts;
const createdContactsFrom = (methods: any[]) => methods[0]?.params?.participants?.[0]?.person?.contacts;

describe('contact relationship (factory #4683)', () => {
  const RELATIONSHIP_INPUTS = {
    ...CONTACT_INPUTS,
    contactRelationship: { value: 'GUARDIAN' },
    contactName: { value: 'Ana Rivas' },
  };

  it('offers a relationship select and a contact name in every view', () => {
    for (const view of ['INDIVIDUAL', OFFICIAL, STAFF]) {
      const fields = openForm({ view }, RELATIONSHIP_INPUTS);
      expect(fields?.map((f: any) => f.field)).toEqual(expect.arrayContaining(['contactRelationship', 'contactName']));
    }
  });

  it('offers the whole vocabulary plus an explicit unspecified option', () => {
    const fields = openForm({ view: 'INDIVIDUAL' }, RELATIONSHIP_INPUTS);
    const select = fields?.find((f: any) => f.field === 'contactRelationship');
    expect(select.options.map((o: any) => o.value)).toEqual([
      '',
      'SELF',
      'PARENT',
      'GUARDIAN',
      'CHAPERONE',
      'EMERGENCY',
      'OTHER',
    ]);
  });

  it('defaults to UNSPECIFIED, never to SELF', () => {
    // Defaulting to SELF would assert that a number belongs to the participant when nobody said so —
    // on the field that decides who a director may ring at 9pm about a minor.
    const fields = openForm({ view: 'INDIVIDUAL' }, RELATIONSHIP_INPUTS);
    const select = fields?.find((f: any) => f.field === 'contactRelationship');
    expect(select.options.find((o: any) => o.selected).value).toEqual('');
  });

  it('persists the relationship and the contact name', () => {
    const contacts = createdContactsFrom(save({ view: 'INDIVIDUAL' }, RELATIONSHIP_INPUTS));
    expect(contacts[0].relationship).toEqual('GUARDIAN');
    expect(contacts[0].name).toEqual('Ana Rivas');
  });

  it('preselects a stored relationship when editing', () => {
    const participant = {
      participantId: 'p1',
      person: { contacts: [{ mobileTelephone: STORED_MOBILE, relationship: 'PARENT', name: 'Dad' }] },
    };
    const fields = openForm({ view: 'INDIVIDUAL', participant }, RELATIONSHIP_INPUTS);
    const select = fields?.find((f: any) => f.field === 'contactRelationship');
    expect(select.options.find((o: any) => o.selected).value).toEqual('PARENT');
    expect(fields?.find((f: any) => f.field === 'contactName').value).toEqual('Dad');
  });

  it('clears a stored relationship when the select is emptied', () => {
    const participant = {
      participantId: 'p1',
      person: { contacts: [{ mobileTelephone: STORED_MOBILE, relationship: 'PARENT' }] },
    };
    const emptied = { ...CONTACT_INPUTS, contactRelationship: { value: '' }, contactName: { value: '' } };
    expect(contactsFrom(save({ view: 'INDIVIDUAL', participant }, emptied))[0].relationship).toBeUndefined();
  });

  it('leaves a stored name ALONE when the drawer renders no name input', () => {
    // Absent input and emptied input are different instructions. A reduced form must not speak for a
    // field it never offered — spreading `name: undefined` unconditionally would erase it.
    const participant = {
      participantId: 'p1',
      person: { contacts: [{ mobileTelephone: STORED_MOBILE, name: 'desk', relationship: 'SELF' }] },
    };
    const primary = contactsFrom(save({ view: 'INDIVIDUAL', participant }, CONTACT_INPUTS))[0];
    expect(primary.name).toEqual('desk');
    expect(primary.relationship).toEqual('SELF');
  });
});

describe('contact details', () => {
  it('offers mobile, email and a public checkbox in every view', () => {
    for (const view of ['INDIVIDUAL', OFFICIAL, STAFF]) {
      const fields = openForm({ view }, CONTACT_INPUTS);
      expect(fields?.map((f: any) => f.field)).toEqual(
        expect.arrayContaining(['mobileTelephone', 'emailAddress', 'contactIsPublic']),
      );
    }
  });

  it('persists entered details on a new participant', () => {
    const contacts = createdContactsFrom(save({ view: 'INDIVIDUAL' }, CONTACT_INPUTS));
    expect(contacts).toHaveLength(1);
    expect(contacts[0].mobileTelephone).toEqual(NEW_MOBILE);
    expect(contacts[0].emailAddress).toEqual('ana@example.org');
    expect(contacts[0].isPublic).toEqual(true);
  });

  it('sends NO contacts key when nothing was entered and none stored', () => {
    // `[]` would mean "clear" to the factory; a participant who simply has no phone number must not
    // carry an instruction to wipe a list.
    expect(createdContactsFrom(save({ view: 'INDIVIDUAL' }, NAME_INPUTS))).toBeUndefined();
  });

  it('PRESERVES other contacts when editing the primary — the data-loss case', () => {
    const participant = {
      participantId: 'p1',
      person: {
        contacts: [
          { name: 'primary', mobileTelephone: STORED_MOBILE, emailAddress: 'old@example.org' },
          { name: EMERGENCY, mobileTelephone: OTHER_MOBILE },
        ],
      },
    };
    const contacts = contactsFrom(save({ view: 'INDIVIDUAL', participant }, CONTACT_INPUTS));
    expect(contacts).toHaveLength(2);
    expect(contacts[0].mobileTelephone).toEqual(NEW_MOBILE);
    expect(contacts[1]).toEqual({ name: EMERGENCY, mobileTelephone: OTHER_MOBILE });
  });

  it('keeps fields the drawer does not edit', () => {
    // `name`, `telephone`, `notes` are not on this form; a save must not erase them.
    const participant = {
      participantId: 'p1',
      person: { contacts: [{ name: 'desk', telephone: '+1 555 1111', notes: 'ring twice' }] },
    };
    const primary = contactsFrom(save({ view: 'INDIVIDUAL', participant }, CONTACT_INPUTS))[0];
    expect(primary.name).toEqual('desk');
    expect(primary.telephone).toEqual('+1 555 1111');
    expect(primary.notes).toEqual('ring twice');
  });

  it('drops the primary entry when both fields are cleared, keeping the rest', () => {
    const participant = {
      participantId: 'p1',
      person: {
        contacts: [
          { name: 'primary', mobileTelephone: STORED_MOBILE },
          { name: EMERGENCY, mobileTelephone: OTHER_MOBILE },
        ],
      },
    };
    const cleared = {
      ...NAME_INPUTS,
      mobileTelephone: { value: '' },
      emailAddress: { value: '' },
      contactIsPublic: { checked: false },
    };
    const contacts = contactsFrom(save({ view: 'INDIVIDUAL', participant }, cleared));
    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toEqual(EMERGENCY);
  });

  it('preselects the stored public flag, and treats absent as not public', () => {
    const withFlag = {
      participantId: 'p1',
      person: { contacts: [{ mobileTelephone: STORED_MOBILE, isPublic: true }] },
    };
    const fields = openForm({ view: STAFF, participant: withFlag }, CONTACT_INPUTS);
    expect(fields.find((f: any) => f.field === 'contactIsPublic').checked).toEqual(true);

    const noFlag = { participantId: 'p2', person: { contacts: [{ mobileTelephone: STORED_MOBILE }] } };
    const fields2 = openForm({ view: STAFF, participant: noFlag }, CONTACT_INPUTS);
    expect(fields2.find((f: any) => f.field === 'contactIsPublic').checked).toEqual(false);
  });
});

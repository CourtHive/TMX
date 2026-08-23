/**
 * Editor for individual participants.
 * Allows creating or editing individual participant details.
 */
import { participantConstants, participantRoles, fixtures, tools } from 'tods-competition-factory';
import { validators, renderButtons, renderForm } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { primaryNumber } from 'services/contact/contactLinks';
import { collectContacts } from './collectContacts';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { t, i18next } from 'i18n';

// constants and types
import { ADD_PARTICIPANTS, MODIFY_PARTICIPANT } from 'constants/mutationConstants';
import { CONTACT_RELATIONSHIPS, relationshipKey } from 'constants/contactRelationships';
import type { ContactRowInput } from './collectContacts';
import { RIGHT, STAFF, SUCCESS } from 'constants/tmxConstants';
import { STAFF_ROLES } from 'constants/staffRoles';

/**
 * Form field names per contact index.
 *
 * Index 0 keeps the **unsuffixed** names the single-contact drawer used. That is not nostalgia: those
 * names are the contract the drawer's existing tests assert against, and — more importantly — index 0
 * IS the primary contact, so `mobileTelephone` continues to mean exactly what it always meant. Rows
 * beyond the first take an `_<index>` suffix.
 */
const CONTACT_FIELDS = {
  relationship: 'contactRelationship',
  mobileTelephone: 'mobileTelephone',
  emailAddress: 'emailAddress',
  telephone: 'contactTelephone',
  isPublic: 'contactIsPublic',
  name: 'contactName',
} as const;

type ContactFieldKey = keyof typeof CONTACT_FIELDS;

const contactFieldName = (key: ContactFieldKey, index: number): string =>
  index ? `${CONTACT_FIELDS[key]}_${index}` : CONTACT_FIELDS[key];

const primaryRadioField = (index: number): string => `primaryContact_${index}`;

/** How a stored contact is identified in the "which one is primary" picker. */
const contactRowLabel = (contact: any, index: number): string =>
  contact?.name?.trim() || primaryNumber(contact) || contact?.emailAddress?.trim() || `${index + 1}`;

const { COMPETITOR, OFFICIAL } = participantRoles;
const { INDIVIDUAL } = participantConstants;

/**
 * The role a new participant takes when the form carries no explicit choice. The Staff view is the only
 * one that asks, because it is the only one that rolls up more than a single role.
 *
 * Previously this was `view === OFFICIAL ? OFFICIAL : COMPETITOR` at the point of creation, with no
 * Staff branch at all — so "New participant" from the Staff view created a COMPETITOR, which the Staff
 * filter then excluded. The row was created, vanished from the view that created it, and joined the
 * draw-eligible pool. A TD who typed the name twice got two phantom competitors.
 */
const defaultRoleForView = (view?: string) => (view === OFFICIAL ? OFFICIAL : COMPETITOR);

export function editIndividualParticipant({
  participant,
  view,
  callback,
}: {
  participant?: any;
  view?: string;
  callback?: () => void;
}): any {
  const list = fixtures.countries.map((country: any) => ({
    label: fixtures.countryToFlag(country.iso || '') + ' ' + country.label,
    value: country.ioc,
  }));

  // The Staff view rolls up 17 distinct roles, so it is the one view where the participant's role cannot
  // be inferred from the view alone and has to be asked for.
  const isStaffView = view === STAFF;

  /**
   * Every contact the participant carries, each editable in its own block, plus one blank spare.
   *
   * The spare row IS the "add a contact" affordance. `renderForm` has no button item type and renders
   * once, statically, so an Add control would have meant either a component change (publish cascade)
   * or hand-rolled DOM inside `content` — and `content` is handed a bare object by the drawer's own
   * tests, so appending to it would couple the form to a live DOM it does not otherwise need.
   * Removal needs no control either: clearing a row's reachable fields already means "drop this
   * entry", which is the semantics the single-contact drawer shipped with and which
   * `collectContacts` preserves.
   *
   * `modifyParticipant` REPLACES `person.contacts` rather than merging, so what this drawer chooses
   * not to send is deleted. See `collectContacts` for the three rules that keep that safe.
   */
  const existingContacts: any[] = Array.isArray(participant?.person?.contacts) ? participant.person.contacts : [];
  const contactRowCount = existingContacts.length + 1;
  // Only worth asking once there is a real choice to make. With one stored contact plus the spare,
  // whichever the director fills in first is the primary and a picker would just be noise.
  const offerPrimaryChoice = existingContacts.length > 1;

  const values = {
    participantRole: participant?.participantRole || defaultRoleForView(view),
    nationalityCode: participant?.person?.nationalityCode,
    firstName: participant?.person?.standardGivenName,
    lastName: participant?.person?.standardFamilyName,
    nickname: participant?.participantOtherName,
    birthDate: participant?.person?.birthDate,
    sex: participant?.person?.sex,
  };
  let inputs: any;

  // Staff roles are sorted for display but the option VALUES stay the factory constants — the label is
  // localized, the value is never derived from it.
  const staffRoleOptions = [...STAFF_ROLES]
    .map((role) => ({ label: t(`participantRoles.${role}`, { defaultValue: role }), value: role }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    .map((option) => ({ ...option, selected: option.value === values.participantRole }));

  const submittedParticipantRole = (): string =>
    (isStaffView && inputs.participantRole?.value) || values.participantRole;

  /**
   * Read one contact block back out of the form.
   *
   * Returns `undefined` when the form rendered NO reachable input for that index — which is how a
   * reduced form (or a test driving the drawer with a subset of inputs) tells `collectContacts` "I
   * have no opinion about this row, leave it alone" rather than "the director emptied it".
   */
  const readContactRow = (index: number): ContactRowInput | undefined => {
    const mobileInput = inputs[contactFieldName('mobileTelephone', index)];
    const telephoneInput = inputs[contactFieldName('telephone', index)];
    const emailInput = inputs[contactFieldName('emailAddress', index)];
    const relationshipInput = inputs[contactFieldName('relationship', index)];
    const nameInput = inputs[contactFieldName('name', index)];
    const publicInput = inputs[contactFieldName('isPublic', index)];

    if (!mobileInput && !telephoneInput && !emailInput) return undefined;

    return {
      mobileTelephone: mobileInput?.value?.trim() || undefined,
      relationshipOffered: !!relationshipInput,
      telephone: telephoneInput?.value?.trim() || undefined,
      emailAddress: emailInput?.value?.trim() || undefined,
      relationship: relationshipInput?.value || undefined,
      name: nameInput?.value?.trim() || undefined,
      telephoneOffered: !!telephoneInput,
      isPublic: !!publicInput?.checked,
      nameOffered: !!nameInput,
    };
  };

  /** Which row the director marked primary, or `undefined` when the picker was not rendered. */
  const submittedPrimaryIndex = (): number | undefined => {
    for (let index = 0; index < contactRowCount; index++) {
      if (inputs[primaryRadioField(index)]?.checked) return index;
    }
    return undefined;
  };

  /**
   * The full `person.contacts` array to persist, or `undefined` to leave it untouched.
   *
   * `undefined` matters: the factory treats an omitted `contacts` as "leave alone" and an empty array
   * as "clear". Returning `[]` for a participant who simply has no contact details would wipe an
   * imported list the moment someone edited their name.
   */
  const submittedContacts = (): any[] | undefined =>
    collectContacts({
      rows: Array.from({ length: contactRowCount }, (_, index) => readContactRow(index)),
      primaryIndex: submittedPrimaryIndex(),
      existing: existingContacts,
    });

  const nationalityCodeValue = (value: string) => (values.nationalityCode = value);

  // `values.nationalityCode` is only written by the type-ahead's selection callback, so an
  // emptied field would otherwise still submit the previously stored code — clearing the
  // country by deleting the text and pressing Save silently did nothing, while deleting it
  // and pressing Enter worked (the type-ahead reports '' for an empty field on Enter).
  // Reading the input back at save time makes both paths agree.
  //
  // '' is the engine's explicit "remove this value"; a participant being created has nothing
  // to clear, so the add path sends undefined instead of an empty string.
  const submittedNationalityCode = (): string | undefined => {
    const displayed = inputs.nationalityCode?.value?.trim();
    if (displayed) return values.nationalityCode;
    return participant?.participantId ? '' : undefined;
  };

  const validValues = ({ firstName, lastName, nickname }: any) => {
    const hasFullName = validators.nameValidator(2)(firstName || '') && validators.nameValidator(2)(lastName || '');
    const hasNickname = nickname && nickname.trim().length >= 2;
    return hasFullName || hasNickname;
  };

  const enableSubmit = ({ inputs }: any) => {
    const valid = validValues({
      firstName: inputs['firstName'].value,
      lastName: inputs['lastName'].value,
      nickname: inputs['nickname']?.value,
    });
    const saveButton = document.getElementById('saveParticipant');
    if (saveButton) (saveButton as HTMLButtonElement).disabled = !valid;
  };

  const relationships = [
    {
      onInput: enableSubmit,
      control: 'firstName',
    },
    {
      onInput: enableSubmit,
      control: 'lastName',
    },
    {
      onInput: enableSubmit,
      control: 'nickname',
    },
  ];

  /**
   * One contact block. Index 0 renders exactly the fields the single-contact drawer rendered, under
   * the same field names, so the primary contact's form is unchanged for the overwhelmingly common
   * case of a participant with zero or one contact.
   */
  const contactRowItems = (index: number): any[] => {
    const contact = existingContacts[index] ?? {};
    const heading =
      index === 0
        ? t('pages.participants.editParticipant.primaryContact')
        : `${t('pages.participants.editParticipant.additionalContact')} ${index + 1}`;

    return [
      // Only label the blocks once there is more than one of them to tell apart.
      ...(contactRowCount > 1 ? [{ divider: true }, { text: heading, header: true }] : []),
      {
        placeholder: t('pages.participants.editParticipant.mobilePlaceholder'),
        label: t('pages.participants.editParticipant.mobile'),
        field: contactFieldName('mobileTelephone', index),
        id: contactFieldName('mobileTelephone', index),
        value: contact.mobileTelephone || '',
      },
      // Rendered only where one is already stored. `Contact.telephone` arrives by import and the call
      // sheet displays it, so leaving it off the form entirely would show a director a number they
      // could not correct — the gap this increment exists to close. Adding it unconditionally would
      // put a sixth field on every block of the longest form in the app for a value almost nobody
      // types by hand.
      ...(contact.telephone
        ? [
            {
              placeholder: t('pages.participants.editParticipant.telephonePlaceholder'),
              label: t('pages.participants.editParticipant.telephone'),
              field: contactFieldName('telephone', index),
              id: contactFieldName('telephone', index),
              value: contact.telephone,
            },
          ]
        : []),
      {
        placeholder: t('pages.participants.editParticipant.emailPlaceholder'),
        label: t('pages.participants.editParticipant.email'),
        field: contactFieldName('emailAddress', index),
        id: contactFieldName('emailAddress', index),
        value: contact.emailAddress || '',
      },
      {
        // Whose number this is. Defaults to UNSET rather than to SELF: defaulting would assert
        // something nobody entered, on a field that decides who a director may ring at 9pm about a
        // minor. An unlabelled contact stays unlabelled until someone says otherwise.
        label: t('pages.participants.editParticipant.contactRelationship'),
        field: contactFieldName('relationship', index),
        options: [
          // Explicit empty string, never `undefined` — a valueless <option> makes `select.value`
          // fall back to the option TEXT, which is how a localized label once got persisted as
          // `person.sex`. Same trap, same fix.
          {
            label: t('pages.participants.contactRelationship.unspecified'),
            selected: !contact.relationship,
            value: '',
          },
          ...CONTACT_RELATIONSHIPS.map((relationship) => ({
            selected: contact.relationship === relationship,
            label: t(relationshipKey(relationship)),
            value: relationship,
          })),
        ],
      },
      {
        // The contact's own name — "Ana Rivas", not the competitor's. Only meaningful once a
        // relationship says the number belongs to someone else, which is why it arrives with it.
        placeholder: t('pages.participants.editParticipant.contactNamePlaceholder'),
        label: t('pages.participants.editParticipant.contactName'),
        field: contactFieldName('name', index),
        id: contactFieldName('name', index),
        value: contact.name || '',
      },
      {
        // Records the person's consent to have THIS CONTACT shared publicly — per contact, not per
        // person, because the factory gates publication per contact (`getTournamentInfo` filters on
        // `isPublic === true`). It is not a promise that the contact appears anywhere:
        // `tournamentContacts` publishes only for the staff roles the factory lists, so ticking it
        // for a competitor stores consent that no current surface acts on. Keeping the label about
        // the contact rather than about a destination is what keeps it honest — and it spares TMX
        // from duplicating the factory's role list, which is how SCOREKEEPER and TIMEKEEPER went
        // missing from the Staff view for months.
        label: t('pages.participants.editParticipant.contactIsPublic'),
        field: contactFieldName('isPublic', index),
        id: contactFieldName('isPublic', index),
        checked: contact.isPublic === true,
        checkbox: true,
      },
    ];
  };

  /**
   * Which contact is the primary — expressed as a position, not a stored marker.
   *
   * `contacts[0]` is what every existing reader treats as primary: `getTournamentInfo`'s published
   * contact, the participants table's `hasContact` / `contactPublic` columns, the group
   * contact-person row. An `isPrimary` field would be a second source of truth for a fact the array
   * order already carries, and the two would drift the first time anything wrote one without the
   * other. So the picker reorders on save.
   */
  const primaryContactPicker = (): any[] => {
    if (!offerPrimaryChoice) return [];
    return [
      { divider: true },
      {
        label: t('pages.participants.editParticipant.whichPrimary'),
        field: 'primaryContact',
        id: 'primaryContact',
        radio: true,
        options: existingContacts.map((contact: any, index: number) => ({
          // `text` doubles as the radio's DOM value in `renderField`, so the selection is read back
          // through the per-option `field` and `.checked` — never by comparing the displayed text.
          text: contactRowLabel(contact, index),
          field: primaryRadioField(index),
          checked: index === 0,
        })),
      },
    ];
  };

  const content = (elem: HTMLElement) => {
    inputs = renderForm(
      elem,
      [
        {
          error: t('pages.participants.editParticipant.nameError'),
          value: values.firstName || '',
          validator: validators.nameValidator(2),
          placeholder: t('pages.participants.editParticipant.firstNamePlaceholder'),
          label: t('pages.participants.editParticipant.firstName'),
          field: 'firstName',
          focus: true,
        },
        {
          error: t('pages.participants.editParticipant.nameError'),
          value: values.lastName || '',
          validator: validators.nameValidator(2),
          placeholder: t('pages.participants.editParticipant.lastNamePlaceholder'),
          label: t('pages.participants.editParticipant.lastName'),
          field: 'lastName',
        },
        {
          value: values.nickname || '',
          placeholder: t('pages.participants.editParticipant.nicknamePlaceholder'),
          label: t('pages.participants.editParticipant.nickname'),
          field: 'nickname',
        },
        // Staff only. INDIVIDUAL and OFFICIAL views each map to exactly one role, so offering a select
        // there would invite a participant into a view it would then disappear from — the same class of
        // bug this select exists to close.
        ...(isStaffView
          ? [
              {
                options: staffRoleOptions,
                value: values.participantRole,
                label: t('pages.participants.staffRole'),
                field: 'participantRole',
              },
            ]
          : []),
        {
          value: undefined,
          label: t('pages.participants.editParticipant.sex'),
          field: 'sex',
          options: [
            // Explicit empty string, never `undefined`: `renderOptions` only writes a
            // value attribute when one is supplied, and a valueless <option> makes
            // `select.value` fall back to the option *text* — which is how the
            // localized "Unknown" label was being persisted as `person.sex`.
            { label: t('pages.participants.gender.unknown'), value: '', selected: !values.sex },
            { label: t('pages.participants.gender.male'), value: 'MALE', selected: values.sex === 'MALE' },
            { label: t('pages.participants.gender.female'), value: 'FEMALE', selected: values.sex === 'FEMALE' },
          ],
        },
        {
          placeholder: t('pages.participants.editParticipant.birthdayPlaceholder'),
          value: values.birthDate || '',
          label: t('pages.participants.editParticipant.dateOfBirth'),
          field: 'birthday',
          date: true,
          language: i18next.language,
        },
        {
          // `currentValue` — not `value` — is what resolves the stored IOC code to its
          // flag+name label. Passing `value` put the bare code ('FRA') in the field,
          // which reads as unpopulated next to a picker that lists country names.
          typeAhead: { list, callback: nationalityCodeValue, currentValue: values.nationalityCode },
          placeholder: t('pages.participants.editParticipant.countryPlaceholder'),
          field: 'nationalityCode',
          label: t('pages.participants.editParticipant.country'),
        },
        // Contact details, for EVERY participant rather than staff alone. A director needs to reach a
        // competitor at least as urgently as an official — an ALTERNATE who might get into the draw is
        // the case that makes it obvious. Before this, TMX could display `person.contacts` in one place
        // and could not enter them anywhere; they arrived only via CSV/Sheets import.
        //
        // One block per stored contact, plus a blank spare to add the next one. A participant with no
        // contacts sees exactly one block — the form the single-contact drawer rendered.
        ...Array.from({ length: contactRowCount }, (_, index) => index).flatMap(contactRowItems),
        ...primaryContactPicker(),
      ],
      relationships,
    );
  };

  const footer = (elem: HTMLElement, close: () => void) =>
    renderButtons(
      elem,
      [
        { label: t('common.cancel'), close: true },
        {
          disabled: !validValues(values),
          onClick: saveParticipant,
          id: 'saveParticipant',
          intent: 'is-info',
          label: t('common.save'),
          close: true,
        },
      ],
      close,
    );

  const drawerTitle = participant
    ? t('pages.participants.editParticipant.editParticipantTitle')
    : t('pages.participants.editParticipant.newParticipantTitle');
  context.drawer.open({
    title: `<b style='larger'>${drawerTitle}</b>`,
    callback: () => {},
    width: '300px',
    side: RIGHT,
    content,
    footer,
  });

  function saveParticipant(): void {
    if (participant?.participantId) {
      const person = {
        // Never `inputs.nationalityCode.value` — after a selection that holds the
        // human-readable label, and `modifyParticipant` silently skips a nationalityCode
        // that fails `validNationalityCode()`, which discarded every country edit.
        nationalityCode: submittedNationalityCode(),
        standardFamilyName: inputs.lastName.value,
        standardGivenName: inputs.firstName.value,
        birthDate: inputs.birthday.value,
        sex: inputs.sex.value || undefined,
        // `undefined` means "leave the stored list alone" — the factory only replaces `contacts` when
        // the key is present, so a name-only edit must not carry one.
        contacts: submittedContacts(),
      };
      const participantOtherName = inputs.nickname?.value || undefined;
      // A TD learns a person's actual role at least as often after entering them as before — a
      // "volunteer" turns out to be the stringer. Sent only from the Staff view, so no other view can
      // move a participant into a role its own filter would then hide it behind.
      const roleUpdate = isStaffView ? { participantRole: submittedParticipantRole() } : {};
      const methods = [
        {
          params: {
            participant: { participantId: participant.participantId, participantOtherName, person, ...roleUpdate },
          },
          method: MODIFY_PARTICIPANT,
        },
      ];
      mutationRequest({ methods, callback: postMutation });
    } else {
      addParticipant();
    }
  }

  // A rejected mutation used to go to console.log, so a failed save was
  // indistinguishable from a successful one at the UI.
  function postMutation(result: any): void {
    if (result.success) {
      if (isFunction(callback)) callback();
    } else {
      tmxToast({ message: t('toasts.cannotModifyParticipant'), intent: 'is-danger' });
    }
  }

  function addParticipant(): void {
    const firstName = inputs.firstName.value;
    const lastName = inputs.lastName.value;
    const sex = inputs.sex.value || undefined;
    const newParticipant = {
      participantRole: submittedParticipantRole(),
      participantType: INDIVIDUAL,
      participantId: tools.UUID(),
      person: {
        nationalityCode: submittedNationalityCode(),
        standardGivenName: firstName,
        standardFamilyName: lastName,
        // Omitted entirely when nothing was entered, rather than sent as `[]` — a new participant with
        // no contact details should carry no `contacts` key at all.
        ...(submittedContacts() ? { contacts: submittedContacts() } : {}),
        sex,
      },
    };

    const methods = [
      {
        params: { participants: [newParticipant] },
        method: ADD_PARTICIPANTS,
      },
    ];
    mutationRequest({ methods, callback: postMutation });
  }

  return { ...SUCCESS };
}

/**
 * Editor for individual participants.
 * Allows creating or editing individual participant details.
 */
import { participantConstants, participantRoles, fixtures, tools } from 'tods-competition-factory';
import { validators, renderButtons, renderForm } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { t, i18next } from 'i18n';

// constants
import { ADD_PARTICIPANTS, MODIFY_PARTICIPANT } from 'constants/mutationConstants';
import { RIGHT, STAFF, SUCCESS } from 'constants/tmxConstants';
import { STAFF_ROLES } from 'constants/staffRoles';

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
   * The contact this drawer edits — the participant's FIRST, treated as their primary.
   *
   * The rest of the array is preserved untouched on save. `modifyParticipant` replaces
   * `person.contacts` rather than merging (deliberately, so a contact can be removed), which means a
   * drawer that edited one contact and dispatched `[thatContact]` would silently DELETE every other
   * contact on an imported record that carries several. See `submittedContacts`.
   */
  const existingContacts: any[] = Array.isArray(participant?.person?.contacts) ? participant.person.contacts : [];
  const primaryContact = existingContacts[0] ?? {};

  const values = {
    participantRole: participant?.participantRole || defaultRoleForView(view),
    nationalityCode: participant?.person?.nationalityCode,
    firstName: participant?.person?.standardGivenName,
    lastName: participant?.person?.standardFamilyName,
    mobileTelephone: primaryContact.mobileTelephone,
    emailAddress: primaryContact.emailAddress,
    nickname: participant?.participantOtherName,
    contactIsPublic: primaryContact.isPublic === true,
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
   * The full `person.contacts` array to persist, or `undefined` to leave it untouched.
   *
   * `undefined` matters: the factory treats an omitted `contacts` as "leave alone" and an empty array as
   * "clear". Returning `[]` for a participant who simply has no contact details would wipe an imported
   * list the moment someone edited their name.
   */
  const submittedContacts = (): any[] | undefined => {
    const mobileTelephone = inputs.mobileTelephone?.value?.trim() || undefined;
    const emailAddress = inputs.emailAddress?.value?.trim() || undefined;
    const isPublic = !!inputs.contactIsPublic?.checked;

    // Nothing entered and nothing stored — send no `contacts` key at all.
    if (!mobileTelephone && !emailAddress && !existingContacts.length) return undefined;

    // Both fields cleared on a participant whose primary contact carried only those two: drop that
    // entry rather than persisting an empty shell, but keep any other contacts they have.
    const primaryIsEmpty = !mobileTelephone && !emailAddress;
    const rest = existingContacts.slice(1);
    if (primaryIsEmpty) return rest;

    // Spread the existing entry first so fields this drawer does not edit — `name`, `telephone`, `fax`,
    // `notes`, extensions — survive.
    return [{ ...primaryContact, mobileTelephone, emailAddress, isPublic }, ...rest];
  };

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
        {
          placeholder: t('pages.participants.editParticipant.mobilePlaceholder'),
          label: t('pages.participants.editParticipant.mobile'),
          value: values.mobileTelephone || '',
          field: 'mobileTelephone',
        },
        {
          placeholder: t('pages.participants.editParticipant.emailPlaceholder'),
          label: t('pages.participants.editParticipant.email'),
          value: values.emailAddress || '',
          field: 'emailAddress',
        },
        {
          // Records the person's consent to have THIS CONTACT shared publicly. It is not a promise that
          // the contact appears anywhere: `tournamentContacts` publishes public contacts only for the
          // staff roles the factory lists, so ticking it for a competitor stores consent that no current
          // surface acts on. Keeping the label about the contact rather than about a destination is what
          // keeps it honest — and it spares TMX from duplicating the factory's role list, which is how
          // SCOREKEEPER and TIMEKEEPER went missing from the Staff view for months.
          label: t('pages.participants.editParticipant.contactIsPublic'),
          checked: values.contactIsPublic,
          field: 'contactIsPublic',
          id: 'contactIsPublic',
          checkbox: true,
        },
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

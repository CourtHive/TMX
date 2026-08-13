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
import { RIGHT, SUCCESS } from 'constants/tmxConstants';

const { COMPETITOR, OFFICIAL } = participantRoles;
const { INDIVIDUAL } = participantConstants;

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

  const values = {
    nationalityCode: participant?.person?.nationalityCode,
    firstName: participant?.person?.standardGivenName,
    lastName: participant?.person?.standardFamilyName,
    nickname: participant?.participantOtherName,
    birthDate: participant?.person?.birthDate,
    sex: participant?.person?.sex,
  };
  let inputs: any;

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
      };
      const participantOtherName = inputs.nickname?.value || undefined;
      const methods = [
        {
          params: {
            participant: { participantId: participant.participantId, participantOtherName, person },
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
      participantRole: view === OFFICIAL ? OFFICIAL : COMPETITOR,
      participantType: INDIVIDUAL,
      participantId: tools.UUID(),
      person: {
        nationalityCode: submittedNationalityCode(),
        standardGivenName: firstName,
        standardFamilyName: lastName,
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

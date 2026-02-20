/**
 * Editor for individual participants.
 * Allows creating or editing individual participant details.
 */
import { participantConstants, participantRoles, fixtures, tools } from 'tods-competition-factory';
import { validators, renderButtons, renderForm } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { t } from 'i18n';

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
    birthDate: participant?.person?.birthDate,
    sex: participant?.person?.sex,
  };
  let inputs: any;

  const nationalityCodeValue = (value: string) => (values.nationalityCode = value);

  const validValues = ({ firstName, lastName }: any) =>
    validators.nameValidator(2)(firstName || '') && validators.nameValidator(2)(lastName || '');

  const enableSubmit = ({ inputs }: any) => {
    const valid = validValues({
      firstName: inputs['firstName'].value,
      lastName: inputs['lastName'].value,
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
          value: undefined,
          label: t('pages.participants.editParticipant.sex'),
          field: 'sex',
          options: [
            { label: t('pages.participants.gender.unknown'), value: undefined, selected: !values.sex },
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
        },
        {
          typeAhead: { list, callback: nationalityCodeValue },
          placeholder: t('pages.participants.editParticipant.countryPlaceholder'),
          value: values.nationalityCode || '',
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
        nationalityCode: inputs.nationalityCode.value,
        standardFamilyName: inputs.lastName.value,
        standardGivenName: inputs.firstName.value,
        birthdate: inputs.birthday.value,
        sex: inputs.sex.value,
      };
      const methods = [
        {
          params: { participant: { participantId: participant.participantId, person } },
          method: MODIFY_PARTICIPANT,
        },
      ];
      const postMutation = (result: any) => {
        if (result.success) {
          if (isFunction(callback)) callback();
        } else {
          console.log(result);
        }
      };
      mutationRequest({ methods, callback: postMutation });
    } else {
      addParticipant();
    }
  }

  function addParticipant(): void {
    const firstName = inputs.firstName.value;
    const lastName = inputs.lastName.value;
    const sex = inputs.sex.value;
    const newParticipant = {
      participantRole: view === OFFICIAL ? OFFICIAL : COMPETITOR,
      participantType: INDIVIDUAL,
      participantId: tools.UUID(),
      person: {
        nationalityCode: values.nationalityCode,
        standardGivenName: firstName,
        standardFamilyName: lastName,
        sex,
      },
    };

    const postMutation = (result: any) => {
      if (result.success && isFunction(callback)) callback();
      if (!result.success) console.log(result);
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

import { participantConstants, participantRoles, fixtures, tools } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'components/renderers/renderButtons';
import { renderForm } from 'components/renderers/renderForm';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_PARTICIPANTS, MODIFY_PARTICIPANT } from 'constants/mutationConstants';
import { RIGHT, SUCCESS } from 'constants/tmxConstants';

const { COMPETITOR, OFFICIAL } = participantRoles;
const { INDIVIDUAL } = participantConstants;

export function editIndividualParticipant({ participant, view, callback }) {
  const list = fixtures.countries.map((country) => ({
    label: fixtures.countryToFlag(country.iso || '') + ' ' + country.label,
    value: country.ioc,
  }));

  const values = {
    nationalityCode: participant?.person?.nationalityCode,
    firstName: participant?.person?.standardGivenName,
    lastName: participant?.person?.standardFamilyName,
    sex: participant?.person?.sex,
  };
  let inputs;

  const nationalityCodeValue = (value) => (values.nationalityCode = value);

  const validValues = ({ firstName, lastName }) =>
    nameValidator(2)(firstName || '') && nameValidator(2)(lastName || '');

  const enableSubmit = ({ inputs }) => {
    const valid = validValues({
      firstName: inputs['firstName'].value,
      lastName: inputs['lastName'].value,
    });
    const saveButton = document.getElementById('saveParticipant');
    if (saveButton) saveButton.disabled = !valid;
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

  const content = (elem) => {
    inputs = renderForm(
      elem,
      [
        {
          error: 'Please enter a name of at least 3 characters',
          value: values.firstName || '',
          validator: nameValidator(2),
          placeholder: 'Given name',
          label: 'First name',
          field: 'firstName',
          focus: true,
        },
        {
          error: 'Please enter a name of at least 3 characters',
          value: values.lastName || '',
          validator: nameValidator(2),
          placeholder: 'Family name',
          label: 'Last name',
          field: 'lastName',
        },
        {
          value: undefined,
          label: 'Sex',
          field: 'sex',
          options: [
            { label: 'Unknown', value: undefined, selected: !values.sex },
            { label: 'Male', value: 'MALE', selected: values.sex === 'MALE' },
            { label: 'Female', value: 'FEMALE', selected: values.sex === 'FEMALE' },
          ],
        },
        {
          placeholder: 'Birthday',
          value: values.birthDate || '',
          label: 'Date of birth',
          field: 'birthday',
          date: true,
        },
        {
          typeAhead: { list, callback: nationalityCodeValue },
          placeholder: 'Country of origin',
          value: values.nationalityCode || '',
          field: 'nationalityCode',
          label: 'Country',
        },
        // school, club, team => autocomplete from GROUP participants in tournament
        // city, state, phone, email
      ],
      relationships,
    );
  };

  const footer = (elem, close) =>
    renderButtons(
      elem,
      [
        { label: 'Cancel', close: true },
        {
          disabled: !validValues(values),
          onClick: saveParticipant,
          id: 'saveParticipant',
          intent: 'is-info',
          label: 'Save',
          close: true,
        },
      ],
      close,
    );

  const action = participant ? 'Edit' : 'New';
  context.drawer.open({
    title: `<b style='larger'>${action} participant</b>`,
    callback: () => {},
    width: '300px',
    side: RIGHT,
    content,
    footer,
  });

  function saveParticipant() {
    if (!participant?.participantId) {
      addParticipant();
    } else {
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
      const postMutation = (result) => {
        if (result.success) {
          isFunction(callback) && callback();
        } else {
          console.log(result);
        }
      };
      mutationRequest({ methods, callback: postMutation });
    }
  }

  function addParticipant() {
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

    const postMutation = (result) => {
      result.success && isFunction(callback) && callback();
      !result.success && console.log(result);
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

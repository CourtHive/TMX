import { participantConstants, participantRoles, fixtures } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'components/renderers/renderButtons';
import { renderForm } from 'components/renderers/renderForm';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_PARTICIPANTS } from 'constants/mutationConstants';
import { RIGHT, SUCCESS } from 'constants/tmxConstants';

const { COMPETITOR, OFFICIAL } = participantRoles;
const { INDIVIDUAL } = participantConstants;

export function editParticipant({ participant, view, refresh }) {
  const list = fixtures.countries.map((country) => ({
    label: fixtures.countryToFlag(country.iso || '') + ' ' + country.label,
    value: country.ioc
  }));

  const values = {
    nationalityCode: participant?.person?.nationalityCode,
    firstName: participant?.person?.standardGivenName,
    lastName: participant?.person?.standardFamilyName,
    sex: participant?.person?.sex
  };
  let inputs;

  const nationalityCodeValue = (value) => (values.nationalityCode = value);
  const valueChange = (e, item) => console.log(item.field, e.target.value);

  const content = (elem) => {
    inputs = renderForm(elem, [
      {
        placeholder: 'Given name',
        value: values.firstName || '',
        label: 'First name',
        field: 'firstName',
        error: 'Please enter a name of at least 3 characters',
        validator: nameValidator(3),
        onChange: valueChange
      },
      {
        placeholder: 'Family name',
        value: values.lastName || '',
        label: 'Last name',
        field: 'lastName',
        error: 'Please enter a name of at least 3 characters',
        validator: nameValidator(3),
        onChange: valueChange
      },
      {
        value: undefined,
        label: 'Sex',
        field: 'sex',
        options: [
          { label: 'Unknown', value: undefined, selected: !values.sex },
          { label: 'Male', value: 'MALE', selected: values.sex === 'MALE' },
          { label: 'Female', value: 'FEMALE', selected: values.sex === 'FEMALE' }
        ],
        onChange: valueChange
      },
      {
        placeholder: 'Birthday',
        value: values.birthDate || '',
        label: 'Date of birth',
        onChange: valueChange,
        field: 'birthday',
        date: true
      },
      {
        typeAhead: { list, callback: nationalityCodeValue },
        placeholder: 'Country of origin',
        value: values.nationalityCode || '',
        field: 'nationalityCode',
        label: 'Country'
      }
      // school, club, team => autocomplete from GROUP participants in tournament
      // city, state, phone, email
    ]);
  };

  const footer = (elem, close) =>
    renderButtons(
      elem,
      [
        { label: 'Cancel', close: true },
        { label: 'Save', onClick: saveParticipant, close: true, intent: 'is-info' }
      ],
      close
    );

  context.drawer.open({
    title: `<b style='larger'>New participant</b>`,
    callback: () => console.log('drawer callback'),
    context: 'tournament',
    width: '300px',
    side: RIGHT,
    content,
    footer
  });

  function saveParticipant() {
    if (!participant?.participantId) {
      addParticipant();
    } else {
      console.log('update existing');
    }
  }

  function addParticipant() {
    const firstName = inputs.firstName.value;
    const lastName = inputs.lastName.value;
    const sex = inputs.sex.value;
    const newParticipant = {
      participantType: INDIVIDUAL,
      participantRole: view === OFFICIAL ? OFFICIAL : COMPETITOR,
      person: {
        nationalityCode: values.nationalityCode,
        standardGivenName: firstName,
        standardFamilyName: lastName,
        sex
      }
    };

    const postMutation = (result) => {
      if (result.success) {
        // QUESTION: add participant to table, or just refresh?
        isFunction(refresh) && refresh();
      } else {
        console.log(result);
      }
    };
    const methods = [
      {
        method: ADD_PARTICIPANTS,
        params: { participants: [newParticipant] }
      }
    ];
    mutationRequest({ methods, callback: postMutation });
  }

  return { ...SUCCESS };
}

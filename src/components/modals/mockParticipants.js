import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { genderConstants } from 'tods-competition-factory';
import { mocksEngine } from 'tods-competition-factory';
import { context } from 'services/context';

const { FEMALE, MALE, MIXED } = genderConstants;

import { ADD_PARTICIPANTS } from 'constants/mutationConstants';

export function mockParticipants({ callback } = {}) {
  let inputs;

  const generate = () => {
    const count = inputs.participantsCount.value;
    const gender = inputs.gender.value;
    const sex = gender === MIXED ? undefined : gender;

    const { participants } = mocksEngine.generateParticipants({
      category: { ratingType: 'WTN', ratingMin: 14, ratingMax: 19.99 },
      participantsCount: parseInt(count),
      scaleAllParticipants: true,
      sex
    });

    const methods = [
      {
        method: ADD_PARTICIPANTS,
        params: { participants }
      }
    ];

    mutationRequest({ methods, callback });
  };

  const buttons = [
    { label: 'Cancel', intent: 'none', close: true },
    { label: 'Generate', intent: 'is-info', close: true, onClick: generate }
  ];

  const content = (elem) =>
    (inputs = renderForm(elem, [
      {
        options: [
          { label: 'Mixed', value: MIXED, close: true },
          { label: 'Female', value: FEMALE, close: true },
          { label: 'Male', value: MALE, close: true }
        ],
        label: 'Participant gender',
        field: 'gender',
        value: 32
      },
      {
        options: [
          { label: '32', value: 32, close: true },
          { label: '64', value: 64, close: true },
          { label: '128', value: 128, close: true },
          { label: '256', value: 256, close: true }
        ],
        label: 'Participant count',
        field: 'participantsCount',
        value: 32
      }
    ]));

  context.modal.open({ title: 'Generate mock players', content, buttons });
}

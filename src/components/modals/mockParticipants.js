import { mutationRequest } from 'services/mutation/mutationRequest';
import { mocksEngine } from 'tods-competition-factory';
import { context } from 'services/context';

import { ADD_PARTICIPANTS } from 'constants/mutationConstants';

export function mockParticipants({ callback } = {}) {
  const generateParticipants = (sex) => {
    const { participants } = mocksEngine.generateParticipants({
      category: { ratingType: 'WTN', ratingMin: 14, ratingMax: 19.99 },
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
    { label: 'Mixed', intent: 'is-warning', close: true, onClick: generateParticipants },
    { label: 'Female', intent: 'is-primary', close: true, onClick: () => generateParticipants('FEMALE') },
    { label: 'Male', intent: 'is-info', close: true, onClick: () => generateParticipants('MALE') }
  ];
  context.modal.open({ content: 'Generate mock players', buttons });
}

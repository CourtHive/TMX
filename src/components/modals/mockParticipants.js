import { genderConstants, factoryConstants, mocksEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';

const { WTN, UTR } = factoryConstants.ratingConstants;
const { FEMALE, MALE, MIXED, ANY } = genderConstants;

import { ADD_PARTICIPANTS } from 'constants/mutationConstants';

export function mockParticipants({ callback }) {
  let inputs;

  const generate = () => {
    const count = inputs.participantsCount.value;
    const genWtn = inputs.wtnRating.checked;
    const genUtr = inputs.utrRating.checked;
    const gender = inputs.gender.value;
    const sex = gender === MIXED ? undefined : gender;

    const categories = [
      genWtn && { ratingType: WTN, ratingMin: 14, ratingMax: 19.99 },
      genUtr && { ratingType: UTR, ratingMin: 8, ratingMax: 10 },
    ].filter(Boolean);

    const { participants } = mocksEngine.generateParticipants({
      participantsCount: parseInt(count),
      scaleAllParticipants: true,
      categories,
      sex,
    });

    const methods = [
      {
        method: ADD_PARTICIPANTS,
        params: { participants },
      },
    ];

    mutationRequest({ methods, callback });
  };

  const buttons = [
    { label: 'Cancel', intent: 'none', close: true },
    { label: 'Generate', intent: 'is-info', close: true, onClick: generate },
  ];

  const content = (elem) =>
    (inputs = renderForm(elem, [
      {
        options: [
          { label: 'Any', value: ANY, close: true },
          { label: 'Female', value: FEMALE, close: true },
          { label: 'Male', value: MALE, close: true },
        ],
        label: 'Participant gender',
        field: 'gender',
        value: 32,
      },
      {
        options: [
          { label: '8', value: 8, close: true },
          { label: '16', value: 16, close: true },
          { label: '32', value: 32, close: true },
          { label: '64', value: 64, close: true },
          { label: '128', value: 128, close: true },
          { label: '256', value: 256, close: true },
        ],
        label: 'Participant count',
        field: 'participantsCount',
        value: 32,
      },
      {
        text: 'Generate Ratings',
        header: true,
      },
      {
        label: 'WTN',
        field: 'wtnRating',
        id: 'wtnRating',
        checkbox: true,
      },
      {
        label: 'UTR',
        field: 'utrRating',
        id: 'utrRating',
        checkbox: true,
      },
    ]));

  openModal({ title: 'Generate mock players', content, buttons });
}

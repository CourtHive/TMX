/**
 * Generate mock participants modal with ratings.
 * Creates mock players with WTN/UTR ratings and configurable gender/count.
 */
import { genderConstants, factoryConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';

const { WTN, UTR } = factoryConstants.ratingConstants;
const { FEMALE, MALE, MIXED, ANY } = genderConstants;

import { ADD_PARTICIPANTS } from 'constants/mutationConstants';

export function mockParticipants({ callback }: { callback?: () => void }): void {
  let inputs: any;

  // Get tournament end date for birthdate generation
  const tournamentInfo = tournamentEngine.getTournamentInfo()?.tournamentInfo || {};
  const consideredDate = tournamentInfo.endDate || tournamentInfo.startDate;

  const generate = () => {
    const count = inputs.participantsCount.value;
    const genWtn = inputs.wtnRating.checked;
    const genUtr = inputs.utrRating.checked;
    const gender = inputs.gender.value;
    const sex = gender === MIXED ? undefined : gender;
    const ageMin = inputs.ageMin?.value ? Number.parseInt(inputs.ageMin.value) : undefined;
    const ageMax = inputs.ageMax?.value ? Number.parseInt(inputs.ageMax.value) : undefined;

    const categories = [
      genWtn && { ratingType: WTN, ratingMin: 14, ratingMax: 19.99 },
      genUtr && { ratingType: UTR, ratingMin: 8, ratingMax: 10 },
    ].filter(Boolean);

    // Build category object for age-based birthdate generation
    const category =
      ageMin || ageMax
        ? {
            ageMin,
            ageMax,
          }
        : undefined;

    const { participants } = mocksEngine.generateParticipants({
      participantsCount: Number.parseInt(count),
      scaleAllParticipants: true,
      consideredDate,
      categories,
      category,
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

  // Relationships to ensure ageMax >= ageMin
  const relationships = [
    {
      control: 'ageMin',
      onChange: ({ inputs }: any) => {
        const minValue = Number.parseInt(inputs.ageMin.value) || 0;
        const maxValue = Number.parseInt(inputs.ageMax.value) || 0;
        
        // If min > max, adjust max to equal min
        if (minValue > maxValue && maxValue > 0) {
          inputs.ageMax.value = minValue;
        }
      },
    },
    {
      control: 'ageMax',
      onChange: ({ inputs }: any) => {
        const minValue = Number.parseInt(inputs.ageMin.value) || 0;
        const maxValue = Number.parseInt(inputs.ageMax.value) || 0;
        
        // If max < min, adjust min to equal max
        if (maxValue < minValue && minValue > 0 && maxValue > 0) {
          inputs.ageMin.value = maxValue;
        }
      },
    },
  ];

  const content = (elem: HTMLElement) =>
    (inputs = renderForm(
      elem,
      [
        {
          options: [
            { label: 'Any', value: ANY, close: true },
            { label: 'Female', value: FEMALE, close: true },
            { label: 'Male', value: MALE, close: true },
          ],
          label: 'Participant gender',
          field: 'gender',
          value: ANY,
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
          text: 'Participant Age Range',
          header: true,
        },
        {
          label: 'Minimum Age',
          field: 'ageMin',
          placeholder: 'e.g., 10',
          type: 'number',
        },
        {
          label: 'Maximum Age',
          field: 'ageMax',
          placeholder: 'e.g., 18',
          type: 'number',
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
      ],
      relationships,
    ));

  openModal({ title: 'Generate mock players', content, buttons });
}

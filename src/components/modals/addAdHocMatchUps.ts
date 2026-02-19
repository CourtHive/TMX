/**
 * Add ad-hoc matchUps modal with round and count selection.
 * Generates matchUps for selected round number with auto or manual count.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { ADD_ADHOC_MATCHUPS } from 'constants/mutationConstants';

type AddAdHocMatchUpsParams = {
  drawId?: string;
  structure?: any;
  structureId?: string;
  roundNumber?: number;
  callback?: (params: any) => void;
};

export function addAdHocMatchUps({
  drawId,
  structure,
  structureId,
  roundNumber,
  callback,
}: AddAdHocMatchUpsParams = {}): void {
  structureId = structureId || structure?.structureId;

  const matchUps =
    tournamentEngine.allDrawMatchUps({
      matchUpFilters: { structureIds: [structureId] },
      drawId,
    }).matchUps || [];

  const roundNumbers = matchUps.reduce((roundNumbers: number[], matchUp: any) => {
    const roundNumber = matchUp.roundNumber;
    if (roundNumber && !roundNumbers.includes(roundNumber)) roundNumbers.push(roundNumber);
    return roundNumbers;
  }, []);
  const maxRoundNumber = Math.max(...roundNumbers, 1);
  if (matchUps.length) {
    roundNumbers.push(maxRoundNumber + 1);
  } else if (!roundNumbers.length) {
    roundNumbers.push(1);
  }

  let inputs: any;

  const addMatchUps = () => {
    const selectedRoundNumber = Number.parseInt(inputs.roundNumber.value);
    const matchUpsCount =
      inputs.matchUpsCount.value === 'Auto' ? undefined : Number.parseInt(inputs.matchUpsCount.value);

    const result = tournamentEngine.generateAdHocMatchUps({
      roundNumber: selectedRoundNumber,
      matchUpsCount,
      structureId,
      drawId,
    });

    if (!result.matchUps?.length) return;

    const methods = [
      {
        method: ADD_ADHOC_MATCHUPS,
        params: {
          matchUps: result.matchUps,
          structureId,
          drawId,
        },
      },
    ];

    const postMutation = (result: any) => {
      if (result.success) {
        if (isFunction(callback) && callback) callback({ refresh: true });
      } else {
        console.log(result.error);
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const buttons = [
    { label: t('common.cancel'), intent: 'none', close: true },
    { label: t('add'), intent: 'is-success', close: true, onClick: addMatchUps },
  ];

  const roundNumberOptions = roundNumbers.map((rn) => ({ label: rn, value: rn }));
  const roundNumberSelection = {
    text: t('modals.addMatches.roundNumber'),
    fieldPair: {
      options: roundNumberOptions,
      field: 'roundNumber',
      value: roundNumber,
      id: 'roundNumber',
    },
  };
  const matchUpCountOptions = ['Auto', 1, 5, 10].map((rn) => ({ label: rn, value: rn }));
  const matchUpCountSelection = {
    text: t('modals.addMatches.numberToAdd'),
    fieldPair: {
      options: matchUpCountOptions,
      field: 'matchUpsCount',
      id: 'matchUpsCount',
      value: 'Auto',
    },
  };

  const options = [roundNumberSelection, { spacer: true }, matchUpCountSelection];

  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options));

  openModal({ title: t('modals.addMatches.title'), content, buttons });
}

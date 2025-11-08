/**
 * Add ad-hoc round modal with automated drawMatic or manual generation.
 * Creates new round with optional dynamic ratings and participant selection.
 */
import { positionActionConstants, tournamentEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal, openModal } from './baseModal/baseModal';
import { renderForm } from 'components/renderers/renderForm';
import { setActiveScale } from 'settings/setActiveScale';
import { selectParticipant } from './selectParticipant';
import { isFunction } from 'functions/typeOf';
import { env } from 'settings/env';

import { ADD_ADHOC_MATCHUPS, ADD_DYNAMIC_RATINGS } from 'constants/mutationConstants';
import { AUTOMATED, MANUAL, UTR, WTN } from 'constants/tmxConstants';

const { ASSIGN_PARTICIPANT } = positionActionConstants;

type AddAdHocRoundParams = {
  drawId?: string;
  structure?: any;
  structureId?: string;
  newRound?: boolean;
  callback?: (params: any) => void;
};

export function addAdHocRound({ drawId, structure, structureId, callback }: AddAdHocRoundParams = {}): void {
  structureId = structureId || structure?.structureId;
  let update: any, inputs: any;

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

  const lastRoundNumber = roundNumbers[roundNumbers.length - 1];

  const maxRoundNumber = Math.max(...roundNumbers, 1);
  if (matchUps.length) roundNumbers.push(maxRoundNumber + 1);

  const addRound = ({ matchUps, roundResults }: any) => {
    const methods = [
      {
        params: { structureId, matchUps, drawId },
        method: ADD_ADHOC_MATCHUPS,
      },
    ];
    if (roundResults?.length) {
      for (const roundResult of roundResults) {
        const modifiedScaleValues = roundResult?.modifiedScaleValues;
        (methods as any).push({
          params: { modifiedScaleValues, replacePriorValues: true },
          method: ADD_DYNAMIC_RATINGS,
        });
      }
    }

    const postMutation = (result: any) => {
      if (result.success) {
        if (isFunction(callback) && callback) callback({ refresh: true });
      } else {
        console.log(result.error);
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const drawMaticRound = (participantIds: string[]) => {
    const selectedScale = (inputs.wtn.checked && 'wtn') || (inputs.utr.checked && 'utr') || '';
    const { accessor: scaleAccessor, scaleName } = env.scales[selectedScale] ?? {};
    setActiveScale(selectedScale);

    const result = tournamentEngine.drawMatic({
      updateParticipantRatings: true,
      dynamicRatings: true,
      refreshRatings: true,
      participantIds,
      scaleAccessor,
      scaleName,
      drawId,
    });
    if (!result.matchUps?.length) return;
    addRound(result);
  };

  const checkParticipants = ({ participantIds }: { participantIds: string[] }) => {
    const participantsAvailable = tournamentEngine.getParticipants({
      participantFilters: { participantIds },
    }).participants;

    const lastRoundParticipantIds = !lastRoundNumber
      ? []
      : matchUps
          .filter(
            ({ roundNumber, sides }: any) =>
              roundNumber === lastRoundNumber && sides?.some(({ participantId }: any) => participantId),
          )
          .map(({ sides }: any) => sides.map(({ participantId }: any) => participantId))
          .flat();

    const selectedParticipantIds = !lastRoundParticipantIds.length ? participantIds : lastRoundParticipantIds;

    const action = {
      type: ASSIGN_PARTICIPANT,
      participantsAvailable,
    };

    const onSelection = (result: any) => {
      const participantIds = result.selected?.map(({ participantId }: any) => participantId);
      drawMaticRound(participantIds);
    };

    selectParticipant({
      title: 'Confirm player selection',
      selectedParticipantIds,
      activeOnEnter: true,
      selectionLimit: 99,
      onSelection,
      action,
      update,
    });
  };

  const addMatchUps = () => {
    if (inputs[AUTOMATED].value === AUTOMATED) {
      const { drawDefinition } = tournamentEngine.getEvent({ drawId });
      const participantIds = drawDefinition.entries
        .filter(
          ({ entryStatus, entryStage }: any) =>
            !['WITHDRAWN', 'UNGROUPED'].includes(entryStatus) && (!entryStage || entryStage === structure.stage),
        )
        .map(({ participantId }: any) => participantId);

      checkParticipants({ participantIds });
    } else {
      closeModal();
      const result = tournamentEngine.generateAdHocMatchUps({
        newRound: true,
        structureId,
        drawId,
      });

      if (!result.matchUps?.length) return;
      addRound(result);
    }
  };

  const buttons = [
    { label: 'Cancel', intent: 'none', close: true },
    { label: 'Add round', intent: 'is-success', close: false, onClick: addMatchUps },
  ];

  const options = [
    {
      field: AUTOMATED,
      value: AUTOMATED,
      options: [
        { label: AUTOMATED, value: AUTOMATED, selected: true },
        { label: MANUAL, value: false },
      ],
    },
    {
      options: [
        { text: 'WTN', field: 'wtn', checked: env.activeScale === WTN },
        { text: 'UTR', field: 'utr', checked: env.activeScale === UTR },
        { text: 'None', field: 'none', checked: !env.activeScale },
      ],
      onClick: (x: any) => console.log({ x }),
      label: 'Level of play',
      field: 'levelOfPlay',
      id: 'levelOfPlay',
      radio: true,
    },
  ];

  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options));

  update = (openModal as any)({ title: 'Add round', content, structure, buttons }).update;
}

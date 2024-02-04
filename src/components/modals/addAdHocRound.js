import { positionActionConstants, tournamentEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal, openModal } from './baseModal/baseModal';
import { renderForm } from 'components/renderers/renderForm';
import { selectParticipant } from './selectParticipant';
import { isFunction } from 'functions/typeOf';
import { env } from 'settings/env';

import { ADD_ADHOC_MATCHUPS } from 'constants/mutationConstants';
import { AUTOMATED, MANUAL } from 'constants/tmxConstants';

const { ASSIGN_PARTICIPANT } = positionActionConstants;

export function addAdHocRound({ drawId, structure, structureId, callback } = {}) {
  structureId = structureId || structure?.structureId;
  let update, inputs;

  const matchUps =
    tournamentEngine.allDrawMatchUps({
      matchUpFilters: { structureIds: [structureId] },
      drawId,
    }).matchUps || [];

  const roundNumbers = matchUps.reduce((roundNumbers, matchUp) => {
    const roundNumber = matchUp.roundNumber;
    if (roundNumber && !roundNumbers.includes(roundNumber)) roundNumbers.push(roundNumber);
    return roundNumbers;
  }, []);

  const lastRoundNumber = roundNumbers[roundNumbers.length - 1];

  const maxRoundNumber = Math.max(...roundNumbers, 1);
  if (matchUps.length) roundNumbers.push(maxRoundNumber + 1);

  const addRound = (matchUps) => {
    const methods = [
      {
        method: ADD_ADHOC_MATCHUPS,
        params: {
          structureId,
          matchUps,
          drawId,
        },
      },
    ];

    const postMutation = (result) => {
      if (result.success) {
        if (isFunction(callback)) callback({ refresh: true });
      } else {
        console.log(result.error);
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const drawMaticRound = (participantIds) => {
    const { scaleAccessor, scaleName } = env.scales[env.activeScale];
    const result = tournamentEngine.drawMatic({
      participantIds,
      scaleAccessor,
      scaleName,
      drawId,
    });
    if (!result.matchUps?.length) return;
    addRound(result.matchUps);
  };

  const checkParticipants = ({ participantIds }) => {
    const participantsAvailable = tournamentEngine.getParticipants({
      participantFilters: { participantIds },
    }).participants;

    const lastRoundParticipantIds = !lastRoundNumber
      ? []
      : matchUps
          .filter(
            ({ roundNumber, sides }) =>
              roundNumber === lastRoundNumber && sides?.some(({ participantId }) => participantId),
          )
          .map(({ sides }) => sides.map(({ participantId }) => participantId))
          .flat();

    const selectedParticipantIds = !lastRoundParticipantIds.length ? participantIds : lastRoundParticipantIds;

    const action = {
      type: ASSIGN_PARTICIPANT,
      participantsAvailable,
    };

    const onSelection = (result) => {
      const participantIds = result.selected?.map(({ participantId }) => participantId);
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
          ({ entryStatus, entryStage }) =>
            !['WITHDRAWN', 'UNGROUPED'].includes(entryStatus) && (!entryStage || entryStage === structure.stage),
          // TODO: add linked source structure qualifiers
        )
        .map(({ participantId }) => participantId);

      checkParticipants({ participantIds });
    } else {
      closeModal();
      const result = tournamentEngine.generateAdHocMatchUps({
        newRound: true,
        structureId,
        drawId,
      });
      console.log({ result });

      if (!result.matchUps?.length) return;
      addRound(result.matchUps);
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
  ];

  const content = (elem) => (inputs = renderForm(elem, options));

  update = openModal({ title: 'Add round', content, buttons }).update;
}

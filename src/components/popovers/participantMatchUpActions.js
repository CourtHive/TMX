import { selectParticipant } from 'components/modals/selectParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { isFunction } from 'functions/typeOf';
import {
  eventConstants,
  positionActionConstants,
  matchUpActionConstants,
  tournamentEngine,
  tools,
  policyConstants,
} from 'tods-competition-factory';

import { BOTTOM } from 'constants/tmxConstants';

const { SUBSTITUTION, PENALTY, REMOVE_PARTICIPANT, REPLACE_PARTICIPANT } = matchUpActionConstants;
const { POLICY_TYPE_MATCHUP_ACTIONS } = policyConstants;
const { ASSIGN_PARTICIPANT } = positionActionConstants;
const { TEAM, DOUBLES } = eventConstants;

const xa = tools.extractAttributes;

export function participantMatchUpActions(e, cell, callback, params) {
  if (!cell) return;

  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }
  const row = cell.getRow();
  const data = row.getData();
  const def = cell.getColumn().getDefinition();

  const isDoubles = data.matchUpType === DOUBLES;
  const isTeam = data.eventType === TEAM;

  const { matchUpId, drawId } = data;
  const sideNumber = (def.field === 'side1' && 1) || (def.field === 'side2' && 2);
  const { validActions } = tournamentEngine.matchUpActions({
    matchUpId,
    drawId,
    sideNumber,
    policyDefinitions: {
      [POLICY_TYPE_MATCHUP_ACTIONS]: {
        substituteAfterCompleted: true,
        substituteWithoutScore: true,
      },
    },
  });
  const clickedParticipantId = params?.individualParticipant?.participantId;

  const itemMap = {
    [ASSIGN_PARTICIPANT]: {
      params: { data, sideNumber, callback, isTeam, isDoubles },
      text: 'Assign participant',
      method: assignOrReplace,
    },
    [PENALTY]: {
      onClick: () => console.log({ data }),
      text: 'Assess penalty',
    },
    [REMOVE_PARTICIPANT]: {
      params: { data, sideNumber, callback, isTeam, isDoubles, clickedParticipantId },
      text: 'Remove participant',
      method: removeParticipant,
    },
    [REPLACE_PARTICIPANT]: {
      params: { data, sideNumber, callback, isTeam, isDoubles, clickedParticipantId },
      text: 'Replace participant',
      method: assignOrReplace,
    },
    [SUBSTITUTION]: {
      params: { data, sideNumber, callback, isTeam, isDoubles, clickedParticipantId },
      method: assignOrReplace,
      text: 'Substitution',
    },
  };

  const items = validActions
    .filter(({ type }) =>
      [ASSIGN_PARTICIPANT, PENALTY, REMOVE_PARTICIPANT, REPLACE_PARTICIPANT, SUBSTITUTION].includes(type),
    )
    .map((action) => {
      const item = itemMap[action.type];
      return {
        onClick: () => {
          isFunction(item.method)
            ? item.method({ ...item.params, action })
            : isFunction(item.onClick) && item.onClick();
        },
        text: item.text,
      };
    });

  if (items.length === 1) {
    items[0].onClick();
  } else if (items.length > 0 && e?.target) {
    tipster({ items, target: e.target, config: { placement: BOTTOM } });
  }
}

function removeParticipant(params) {
  const { action, callback, clickedParticipantId } = params;
  action.payload.participantId = clickedParticipantId;
  const methods = [{ method: action.method, params: action.payload }];
  const postMutation = (result) => isFunction(callback) && callback(result);
  mutationRequest({ methods, callback: postMutation });
}

function assignOrReplace(params) {
  const { sideNumber, callback, isTeam, isDoubles, data } = params;
  const participantsAvailable = params.action.availableParticipants;
  const matchUpType = data.matchUp.matchUpType;

  const side = data.matchUp.sides.find((side) => sideNumber === side.sideNumber);
  const existingParticipantIds = side?.participant?.individualParticipantIds;
  const existingParticipantId = params.clickedParticipantId;

  const selectionLimit = matchUpType === DOUBLES && !existingParticipantId ? 2 : 1;
  const onSelection = (result) => {
    if (result.participantId || result.selected) {
      const methods = [];
      const participantIds = (
        Array.isArray(result.selected) ? result.selected.map(xa('participantId')) : [result.participantId]
      ).filter(Boolean);

      participantIds.forEach((participantId) => {
        methods.push({
          params: {
            ...params.action.payload,
            substituteParticipantId: participantId,
            newParticipantId: participantId,
            existingParticipantId,
            participantId,
          },
          method: params.action.method,
        });
      });

      const postMutation = (result) => {
        isFunction(callback) && callback(result);
      };
      mutationRequest({ methods, callback: postMutation });
    }
  };

  const action = {
    type: ASSIGN_PARTICIPANT,
    participantsAvailable,
  };

  const title = isTeam && isDoubles ? 'Doubles: Select participants' : undefined;

  selectParticipant({
    selectedParticipantIds: existingParticipantIds,
    selectOnEnter: true,
    selectionLimit,
    onSelection,
    action,
    title,
  });
}

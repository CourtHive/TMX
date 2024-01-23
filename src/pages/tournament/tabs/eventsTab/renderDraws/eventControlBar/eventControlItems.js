import { getStructureOptions } from '../getStructureOptions';
import { eventConstants } from 'tods-competition-factory';
import { getActionOptions } from '../getActionOptions';
import { getDrawsOptions } from '../getDrawsOptions';
import { getEventOptions } from '../getEventOptions';

import { LEFT, RIGHT } from 'constants/tmxConstants';
const { TEAM } = eventConstants;

export function getEventControlItems({
  updateParticipantFilter,
  updateControlBar,
  structureId,
  eventData,
  matchUps,
  eventId,
  drawId,
}) {
  const { eventOptions } = getEventOptions({ eventId, drawId });
  const drawsOptions = getDrawsOptions({ eventData, drawId });

  const drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
  const structureName = drawData?.structures?.find((s) => s.structureId === structureId)?.structureName;
  const dual = matchUps?.length === 1 && eventData.eventInfo.eventType === TEAM;

  const structureOptions = getStructureOptions({
    updateControlBar,
    structureId,
    drawData,
    eventId,
  });
  const actionOptions = getActionOptions({
    dualMatchUp: dual && matchUps[0],
    structureName,
    structureId,
    eventData,
    drawData,
    drawId,
  });

  return [
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateParticipantFilter(''),
      onChange: (e) => updateParticipantFilter(e.target.value),
      onKeyUp: (e) => updateParticipantFilter(e.target.value),
      clearSearch: () => updateParticipantFilter(''),
      placeholder: 'Participant name',
      location: LEFT,
      search: true,
    },
    {
      options: eventOptions.length > 1 ? eventOptions : undefined,
      label: eventData.eventInfo.eventName,
      modifyLabel: true,
      location: LEFT,
    },
    {
      options: drawsOptions.length > 1 ? drawsOptions : undefined,
      label: drawData.drawName,
      modifyLabel: true,
      location: LEFT,
    },
    {
      options: structureOptions.length > 1 ? structureOptions : undefined,
      label: structureName,
      modifyLabel: true,
      location: LEFT,
    },
    {
      options: actionOptions,
      intent: 'is-info',
      label: 'Actions',
      location: RIGHT,
      align: RIGHT,
    },
  ];
}

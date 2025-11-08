/**
 * Event control bar items configuration.
 * Provides search, event/draw/structure navigation, and action options.
 */
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
}: {
  updateParticipantFilter: (value: string) => void;
  updateControlBar: (refresh?: boolean) => void;
  structureId: string;
  eventData: any;
  matchUps: any[];
  eventId: string;
  drawId: string;
}): any[] {
  const { eventOptions } = (getEventOptions as any)({ eventId, drawId });
  const drawsOptions = getDrawsOptions({ eventData, drawId });

  const drawData = eventData?.drawsData?.find((data: any) => data.drawId === drawId);
  const structureName = drawData?.structures?.find((s: any) => s.structureId === structureId)?.structureName;
  const dual = matchUps?.length === 1 && eventData.eventInfo.eventType === TEAM;

  const structureOptions = getStructureOptions({
    updateControlBar,
    structureId,
    drawData,
    eventId,
  });
  const actionOptions = (getActionOptions as any)({
    dualMatchUp: dual && matchUps[0],
    structureName,
    structureId,
    eventData,
    drawData,
    drawId,
  });

  return [
    {
      onKeyDown: (e: KeyboardEvent) => e.keyCode === 8 && (e.target as HTMLInputElement).value.length === 1 && updateParticipantFilter(''),
      onChange: (e: Event) => updateParticipantFilter((e.target as HTMLInputElement).value),
      onKeyUp: (e: Event) => updateParticipantFilter((e.target as HTMLInputElement).value),
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

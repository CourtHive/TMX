/**
 * Event control bar items configuration.
 * Provides search, event/draw/structure navigation, and action options.
 */
import { getStructureOptions } from '../getStructureOptions';
import { getDrawsOptions } from '../getDrawsOptions';

import { LEFT } from 'constants/tmxConstants';

export function getEventControlItems({
  updateParticipantFilter,
  updateControlBar,
  structureId,
  eventData,
  eventId,
  drawId,
}: {
  updateParticipantFilter: (value: string) => void;
  updateControlBar: (refresh?: boolean) => void;
  structureId: string;
  eventData: any;
  eventId: string;
  drawId: string;
}): any[] {
  const drawsOptions = getDrawsOptions({ eventData });

  const drawData = eventData?.drawsData?.find((data: any) => data.drawId === drawId);
  const structureName = drawData?.structures?.find((s: any) => s.structureId === structureId)?.structureName;

  const structureOptions = getStructureOptions({
    updateControlBar,
    structureId,
    drawData,
    eventId,
  });

  return [
    {
      onKeyDown: (e: KeyboardEvent) =>
        e.key === 'Backspace' && (e.target as HTMLInputElement).value.length === 1 && updateParticipantFilter(''),
      onChange: (e: Event) => updateParticipantFilter((e.target as HTMLInputElement).value),
      onKeyUp: (e: Event) => updateParticipantFilter((e.target as HTMLInputElement).value),
      clearSearch: () => updateParticipantFilter(''),
      placeholder: 'Participant name',
      location: LEFT,
      search: true,
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
  ];
}

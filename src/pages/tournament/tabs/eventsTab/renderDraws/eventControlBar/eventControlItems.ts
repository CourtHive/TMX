/**
 * Event control bar items configuration.
 * Provides search, event/draw/structure navigation, and action options.
 */
import { drawDefinitionConstants, eventConstants, tournamentEngine } from 'tods-competition-factory';
import { openConfigureDraft } from 'components/modals/draftConfigure';
import { enterParticipantAssignmentMode } from '../participantAssignmentMode';
import { renderInlineTopology, destroyInlineTopology } from './inlineTopology';
import { getStructureOptions } from '../getStructureOptions';
import { editMatchUpFormat } from '../editMatchUpFormat';
import { getDrawsOptions } from '../getDrawsOptions';
import { renderDrawView } from '../renderDrawView';
import { t } from 'i18n';

import { LEFT, RIGHT } from 'constants/tmxConstants';

const { MAIN } = drawDefinitionConstants;
const { TEAM } = eventConstants;

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
  const structure = drawData?.structures?.find((s: any) => s.structureId === structureId);

  const structureOptions = getStructureOptions({
    updateControlBar,
    structureId,
    drawData,
    eventId,
  });

  const isTeam = eventData?.eventInfo?.eventType === TEAM;

  const items: any[] = [
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

  // RIGHT side icon buttons (order: scoring, topology, then assign participants furthest right)

  // Edit main scoring (non-TEAM events only)
  if (!isTeam) {
    items.push({
      onClick: () => editMatchUpFormat({ structureId, drawId }),
      label: '<i class="fa-solid fa-gear"></i>',
      toolTip: { content: t('pages.events.actionOptions.editScoring', { name: structureName }), placement: 'bottom' },
      location: RIGHT,
    });
  }

  // View topology
  items.push({
    onClick: () => renderInlineTopology({ eventId, drawId, structureId }),
    label: '<i class="fa-solid fa-sitemap"></i>',
    toolTip: { content: t('pages.events.actionOptions.viewTopology'), placement: 'bottom' },
    location: RIGHT,
  });

  // Draft status button when a draft is active
  const drawDefinition = tournamentEngine.findDrawDefinition({ drawId })?.drawDefinition;
  const hasDraft = drawDefinition?.extensions?.some((ext: any) => ext.name === 'draftState');

  if (hasDraft) {
    items.push({
      onClick: () => openConfigureDraft({ drawId, eventId }),
      label: t('pages.events.actionOptions.draftStatus'),
      intent: 'is-info',
      location: RIGHT,
    });
  }

  // "Assign participants" button when there are unassigned positions (furthest right)
  const isMainStage = structure?.stage === MAIN && structure?.stageSequence === 1;
  if (isMainStage && !isTeam && !hasDraft) {
    const unassignedCount =
      structure.positionAssignments?.filter((pa: any) => !pa.participantId && !pa.bye).length ?? 0;
    if (unassignedCount > 0) {
      items.push({
        onClick: () => enterParticipantAssignmentMode({ drawId, eventId, structureId }),
        label: t('pages.events.actionOptions.assignParticipants'),
        intent: 'is-warning',
        location: RIGHT,
      });
    }
  }

  return items;
}

/**
 * Returns simplified control bar items for topology view mode.
 * Only shows draw selector on left and "View Draw" button on right.
 */
export function getTopologyControlItems({
  structureId,
  eventData,
  eventId,
  drawId,
}: {
  structureId: string;
  eventData: any;
  eventId: string;
  drawId: string;
}): any[] {
  const drawsOptions = getDrawsOptions({ eventData });
  const drawData = eventData?.drawsData?.find((data: any) => data.drawId === drawId);

  return [
    {
      options: drawsOptions.length > 1 ? drawsOptions : undefined,
      label: drawData?.drawName,
      modifyLabel: true,
      location: LEFT,
    },
    {
      onClick: () => {
        destroyInlineTopology();
        renderDrawView({ eventId, drawId, structureId, redraw: true });
      },
      label: t('pages.events.actionOptions.viewDraw'),
      intent: 'is-primary',
      location: RIGHT,
    },
  ];
}

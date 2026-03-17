/**
 * Event control bar items configuration.
 * Provides search, event/draw/structure navigation, and action options.
 */
import { drawDefinitionConstants, eventConstants, extensionConstants, tournamentEngine } from 'tods-competition-factory';
import { openConfigureDraft } from 'components/modals/draftConfigure';
import { enterParticipantAssignmentMode } from '../participantAssignmentMode';
import { renderInlineTopology, destroyInlineTopology } from './inlineTopology';
import { editDisplaySettings } from 'components/modals/displaySettings/editDisplaySettings';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getStructureOptions } from '../getStructureOptions';
import { editMatchUpFormat } from '../editMatchUpFormat';
import { getDrawsOptions } from '../getDrawsOptions';
import { displayConfig } from 'config/displayConfig';
import { renderDrawView } from '../renderDrawView';
import { compositions } from 'courthive-components';
import { t } from 'i18n';

import { ADD_DRAW_DEFINITION_EXTENSION, ADD_EVENT_EXTENSION } from 'constants/mutationConstants';
import { LEFT, RIGHT } from 'constants/tmxConstants';

const { MAIN } = drawDefinitionConstants;
const { TEAM } = eventConstants;

export function getEventControlItems({
  updateParticipantFilter,
  structureId,
  eventData,
  drawData,
  eventId,
  drawId,
}: {
  updateParticipantFilter: (value: string) => void;
  structureId: string;
  eventData: any;
  drawData?: any;
  eventId: string;
  drawId: string;
}): any[] {
  const drawsOptions = eventData?.eventInfo ? getDrawsOptions({ eventData }) : [];

  drawData = drawData || eventData?.drawsData?.find((data: any) => data.drawId === drawId);
  const structure = drawData?.structures?.find((s: any) => s.structureId === structureId);
  const structureName = structure?.structureName || structure?.stage || 'Structure';

  const structureOptions = getStructureOptions({
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
      id: 'participantFilter',
      location: LEFT,
      search: true,
    },
    {
      options: drawsOptions.length > 1 ? drawsOptions : undefined,
      label: drawData?.drawName,
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

  // RIGHT side icon buttons (order: display, inline scoring, scoring, topology, then assign participants)

  // Display settings
  items.push({
    onClick: () =>
      editDisplaySettings({
        drawId,
        eventId,
        callback: () => renderDrawView({ eventId, drawId, structureId }),
      }),
    label: '<i class="fa-solid fa-palette"></i>',
    toolTip: { content: t('pages.events.actionOptions.displaySettings'), placement: 'bottom' },
    location: RIGHT,
  });

  // Inline scoring toggle
  if (!isTeam) {
    const display = drawData?.display || eventData?.eventInfo?.display || {};
    const isInlineActive = display?.compositionName === 'InlineScoring';

    const toggleInlineScoring = () => {
      const currentDisplay = tournamentEngine.findExtension({
        name: extensionConstants.DISPLAY,
        discover: true,
        eventId,
        drawId,
      })?.extension?.value;

      const newCompositionName = isInlineActive ? 'National' : 'InlineScoring';
      const newComposition = compositions[newCompositionName];
      const extension = {
        value: {
          ...currentDisplay,
          compositionName: newCompositionName,
          theme: newComposition?.theme,
          configuration: newComposition?.configuration,
        },
        name: extensionConstants.DISPLAY,
      };
      const method = drawId ? ADD_DRAW_DEFINITION_EXTENSION : ADD_EVENT_EXTENSION;
      mutationRequest({
        methods: [{ method, params: { eventId, drawId, extension } }],
        callback: () => {
          displayConfig.set({ composition: newComposition });
          renderDrawView({ eventId, drawId, structureId });
        },
      });
    };

    items.push({
      onClick: toggleInlineScoring,
      label: isInlineActive
        ? '<i class="fa-solid fa-table-tennis-paddle-ball" style="color: var(--chc-color-primary, #3b82f6)"></i>'
        : '<i class="fa-solid fa-table-tennis-paddle-ball"></i>',
      toolTip: { content: isInlineActive ? 'Disable Inline Scoring' : 'Enable Inline Scoring', placement: 'bottom' },
      location: RIGHT,
    });
  }

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
  const drawDefinition = drawId ? tournamentEngine.findDrawDefinition({ drawId })?.drawDefinition : undefined;
  const draftExt = drawDefinition?.extensions?.find((ext: any) => ext.name === 'draftState');

  if (draftExt) {
    const draftComplete = draftExt.value?.status === 'COMPLETE';
    items.push({
      onClick: () => openConfigureDraft({ drawId, eventId, callback: () => renderDrawView({ eventId, drawId, structureId }) }),
      label: t('pages.events.actionOptions.draftStatus'),
      intent: draftComplete ? 'is-info' : 'is-primary',
      location: RIGHT,
    });
  }

  // "Assign participants" button when there are unassigned positions (furthest right)
  const isMainStage = structure?.stage === MAIN && structure?.stageSequence === 1;
  if (isMainStage && !isTeam && !draftExt) {
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

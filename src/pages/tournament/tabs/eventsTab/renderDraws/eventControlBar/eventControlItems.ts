/**
 * Event control bar items configuration.
 * Provides search, event/draw/structure navigation, and action options.
 */
import { editDisplaySettings } from 'components/modals/displaySettings/editDisplaySettings';
import { renderInlineTopology, destroyInlineTopology } from './inlineTopology';
import { enterParticipantAssignmentMode } from '../participantAssignmentMode';
import { openConfigureDraft } from 'components/modals/draftConfigure';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { completeMatchUps } from 'services/devCompleteMatchUps';
import { getStructureOptions } from '../getStructureOptions';
import { editMatchUpFormat } from '../editMatchUpFormat';
import { getActionOptions } from '../getActionOptions';
import { getDrawsOptions } from '../getDrawsOptions';
import { compositions } from 'courthive-components';
import { renderDrawView } from '../renderDrawView';
import { displayConfig } from 'config/displayConfig';
import { t } from 'i18n';
import {
  drawDefinitionConstants,
  eventConstants,
  extensionConstants,
  tournamentEngine,
} from 'tods-competition-factory';

import { ADD_DRAW_DEFINITION_EXTENSION, ADD_EVENT_EXTENSION } from 'constants/mutationConstants';
import { LEFT, RIGHT } from 'constants/tmxConstants';

const { MAIN, QUALIFYING } = drawDefinitionConstants;
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

  // RIGHT side icon buttons (order: complete all, display, inline scoring, scoring, topology, then assign participants)

  // Complete all matchUps (local mode only — no provider)
  const hasProvider = !!tournamentEngine.getTournament().tournamentRecord?.parentOrganisation?.organisationId;
  if (!hasProvider) {
    items.push({
      onClick: () => completeMatchUps({ drawId, structureId }),
      label: '<i class="fa-solid fa-check-double"></i>',
      toolTip: { content: 'Complete all matchUps', placement: 'bottom' },
      location: RIGHT,
    });
  }

  // Display settings
  items.push({
    onClick: () =>
      editDisplaySettings({
        drawId,
        eventId,
        callback: () => renderDrawView({ eventId, drawId, structureId, redraw: true }),
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

      const newCompositionName = isInlineActive ? 'Australian' : 'InlineScoring';
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
          renderDrawView({ eventId, drawId, structureId, redraw: true });
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

  // View topology (only when draw has multiple structures)
  if (drawData?.structures?.length > 1) {
    items.push({
      onClick: () => renderInlineTopology({ eventId, drawId, structureId }),
      label: '<i class="fa-solid fa-sitemap"></i>',
      toolTip: { content: t('pages.events.actionOptions.viewTopology'), placement: 'bottom' },
      location: RIGHT,
    });
  }

  // Draft status button when a draft is active
  const drawDefinition = drawId ? tournamentEngine.findDrawDefinition({ drawId })?.drawDefinition : undefined;
  const draftExt = drawDefinition?.extensions?.find((ext: any) => ext.name === 'draftState');

  if (draftExt) {
    const draftComplete = draftExt.value?.status === 'COMPLETE';
    items.push({
      onClick: () =>
        openConfigureDraft({ drawId, eventId, callback: () => renderDrawView({ eventId, drawId, structureId }) }),
      label: t('pages.events.actionOptions.draftStatus'),
      intent: draftComplete ? 'is-info' : 'is-primary',
      location: RIGHT,
    });
  }

  // "Assign participants" button when there are unassigned positions
  const isAssignableStage =
    (structure?.stage === MAIN && structure?.stageSequence === 1) || structure?.stage === QUALIFYING;
  if (isAssignableStage && !isTeam && !draftExt) {
    const unassignedCount =
      structure.positionAssignments?.filter((pa: any) => !pa.participantId && !pa.bye && !pa.qualifier).length ?? 0;
    if (unassignedCount > 0) {
      items.push({
        onClick: () => enterParticipantAssignmentMode({ drawId, eventId, structureId }),
        label: t('pages.events.actionOptions.assignParticipants'),
        intent: 'is-warning',
        location: RIGHT,
      });
    }
  }

  // [Actions ▼] dropdown — draw-specific actions (furthest right)
  const actionOptions = getActionOptions({ structureId, eventData, drawData, drawId });
  const visibleActions = actionOptions.filter((opt: any) => !opt.hide);
  if (visibleActions.length > 0) {
    items.push({
      options: visibleActions,
      label: t('pages.events.actions', 'Actions'),
      intent: 'is-info',
      location: RIGHT,
      align: RIGHT,
    });
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
  const drawsOptions = eventData?.eventInfo ? getDrawsOptions({ eventData }) : [];
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

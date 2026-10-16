/**
 * Participant Assignment Mode
 * Handles inline participant assignment for draws with no scores.
 * Uses DrawStateManager from courthive-components with TMX mutation layer.
 */
import { controlBar, renderStructure, renderContainer, compositions, DrawStateManager } from 'courthive-components';
import { resolveCompositionByName } from 'services/compositions/resolveCompositionByName';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { renderDrawView } from './renderDrawView';

import { DRAWS_VIEW, EVENT_CONTROL } from 'constants/tmxConstants';
import { t } from 'i18n';

let assignmentMode = false;
let stateManager: DrawStateManager | null = null;

export function isAssignmentMode(): boolean {
  return assignmentMode;
}

/** Silently exit assignment mode without re-rendering (used by router navigation guard) */
export function forceExitAssignmentMode(): void {
  assignmentMode = false;
  stateManager = null;
}

export function enterParticipantAssignmentMode({
  drawId,
  eventId,
  structureId,
}: {
  drawId: string;
  eventId: string;
  structureId: string;
}): void {
  assignmentMode = true;

  // The host queries live state and executes each assignment only through mutationRequest.
  stateManager = new DrawStateManager({
    drawId,
    structureId,
    eventId,
    adapter: {
      getTournamentRecord: () => tournamentEngine.q.tournament(),
      mutate: (method, params, callback) => {
        mutationRequest({
          methods: [{ method, params }],
          callback: (result) => {
            callback(result);
            if (result?.error && !result.notified)
              tmxToast({ message: result.error.message ?? t('common.error'), intent: 'is-danger' });
          },
        });
      },
    },
  });

  // Set render callback for state updates
  const manager = stateManager;
  manager.setRenderCallback(() => {
    if (stateManager !== manager || !assignmentMode) return;
    renderAssignmentView({ drawId, eventId, structureId });
  });

  // Initial render
  renderAssignmentView({ drawId, eventId, structureId });

  // Update control bar to show exit button
  updateControlBarForAssignment({ drawId, eventId, structureId });
}

export function exitParticipantAssignmentMode({
  drawId,
  eventId,
  structureId,
}: {
  drawId: string;
  eventId: string;
  structureId: string;
}): void {
  assignmentMode = false;
  stateManager = null;

  // Return to normal draw view
  renderDrawView({ eventId, drawId, structureId, redraw: true });
}

function renderAssignmentView({
  drawId,
  eventId,
  structureId,
}: {
  drawId: string;
  eventId: string;
  structureId: string;
}): void {
  if (!stateManager) return;
  const manager = stateManager;

  const matchUps = stateManager.getMatchUps();
  const eventData = tournamentEngine.q.eventData({ eventId });
  const drawData = eventData?.drawsData?.find((d: any) => d.drawId === drawId);

  const display = drawData?.display || eventData?.eventInfo?.display || {};
  const compositionName = display?.compositionName;
  const composition = resolveCompositionByName(compositionName) || compositions.National;

  // Show QUALIFIER option only when the current structure receives qualifiers from another structure
  const drawDefinition = tournamentEngine.q.drawDefinition({ drawId });
  const hasQualifying = drawDefinition?.links?.some((link: any) => link.target?.structureId === structureId);

  // Configure for inline assignment with persist mode
  const assignmentComposition = {
    ...composition,
    configuration: {
      ...composition.configuration,
      inlineAssignment: true,
      persistInputFields: true,
      hasQualifying, // Enable QUALIFIER option if qualifying structure exists
      participantProvider: () => stateManager!.getAvailableParticipants(),
    },
  };

  // Event handlers for assignment
  const eventHandlers = {
    assignParticipant: ({ side, participant }: any) => {
      const drawPosition = side?.drawPosition;
      if (!drawPosition) return;

      // Direct assignment - factory handles replacement automatically
      const result = stateManager!.assignParticipant({
        drawPosition,
        participantId: participant.participantId,
      });

      if (!result.success && !result.pending) {
        console.error('Failed to assign participant:', result.error);
      }
    },
    assignBye: ({ side }: any) => {
      const drawPosition = side?.drawPosition;
      if (!drawPosition) return;

      // Direct assignment - factory handles replacement automatically
      const result = stateManager!.assignBye({
        drawPosition,
      });

      if (!result.success && !result.pending) {
        console.error('Failed to assign BYE:', result.error);
      }
    },
    assignQualifier: ({ side }: any) => {
      const drawPosition = side?.drawPosition;
      if (!drawPosition) return;

      // Assign qualifier placeholder
      const result = stateManager!.assignQualifier({
        drawPosition,
      });

      if (!result.success && !result.pending) {
        console.error('Failed to assign QUALIFIER:', result.error);
      }
    },
    removeAssignment: ({ side }: any) => {
      const drawPosition = side?.drawPosition;
      if (!drawPosition) return;

      // Remove assignment when user clears the field
      const result = stateManager!.removeAssignment({
        drawPosition,
      });

      if (!result.success && !result.pending) {
        console.error('Failed to remove assignment:', result.error);
      }
    },
  };

  // Render structure
  const content = renderContainer({
    content: renderStructure({
      context: { drawId, structureId },
      matchUps: matchUps as any,
      eventHandlers,
      composition: assignmentComposition,
      structureId,
    }),
    theme: composition.theme,
  });

  const drawsView = document.getElementById(DRAWS_VIEW);
  if (drawsView) {
    drawsView.innerHTML = '';
    drawsView.appendChild(content);
  }

  // Focus appropriate input after render
  const focusDrawPosition = stateManager.getAndClearFocusDrawPosition();
  if (focusDrawPosition) {
    setTimeout(() => {
      if (stateManager !== manager || !assignmentMode) return;
      const inputToFocus = drawsView?.querySelector(
        `.participant-assignment-input[data-draw-position="${focusDrawPosition}"] input`,
      ) as HTMLInputElement;

      if (inputToFocus) {
        inputToFocus.focus();
      }
    }, 100);
  } else {
    // Focus first input on initial render
    setTimeout(() => {
      if (stateManager !== manager || !assignmentMode) return;
      const firstInput = drawsView?.querySelector('.participant-assignment-input input') as HTMLInputElement;
      firstInput?.focus();
    }, 100);
  }
}

function updateControlBarForAssignment({
  drawId,
  eventId,
  structureId,
}: {
  drawId: string;
  eventId: string;
  structureId: string;
}): void {
  const eventControlElement = document.getElementById(EVENT_CONTROL) || undefined;

  const items = [
    {
      label: t('drawActions.exitAssignmentMode'),
      icon: 'fa fa-times-circle',
      onClick: () => exitParticipantAssignmentMode({ drawId, eventId, structureId }),
      intent: 'is-primary',
    },
  ];

  controlBar({ target: eventControlElement, items });
}

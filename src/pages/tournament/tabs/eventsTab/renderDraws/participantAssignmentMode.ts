/**
 * Participant Assignment Mode
 * Handles inline participant assignment for draws with no scores.
 * Uses DrawStateManager from courthive-components with TMX mutation layer.
 */
import { tournamentEngine } from 'tods-competition-factory';
import { controlBar, renderStructure, renderContainer, compositions, DrawStateManager } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderDrawView } from './renderDrawView';
import { env } from 'settings/env';

import { DRAWS_VIEW, EVENT_CONTROL } from 'constants/tmxConstants';

let assignmentMode = false;
let stateManager: DrawStateManager | null = null;

export function isAssignmentMode(): boolean {
  return assignmentMode;
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

  // Get tournament record
  const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;

  // Initialize base state manager from courthive-components
  const baseStateManager = new DrawStateManager({
    tournamentRecord,
    drawId,
    structureId,
    eventId,
  });

  // Wrap with TMX mutation adapter
  stateManager = createTMXStateManager(baseStateManager, { drawId, eventId, structureId });

  // Set render callback for state updates
  stateManager.setRenderCallback(() => {
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

/**
 * Create TMX-specific state manager that uses mutationRequest
 */
function createTMXStateManager(
  baseManager: DrawStateManager,
  context: { drawId: string; eventId: string; structureId: string }
): DrawStateManager {
  const { drawId, structureId } = context;

  // Override assignParticipant to use TMX mutations
  const originalAssignParticipant = baseManager.assignParticipant.bind(baseManager);
  baseManager.assignParticipant = ({ drawPosition, participantId }) => {
    // Direct assignment - factory handles replacement automatically
    const methods = [
      {
        method: 'assignDrawPosition',
        params: {
          drawId,
          structureId,
          drawPosition,
          participantId,
        },
      },
    ];

    mutationRequest({
      methods,
      callback: (result: any) => {
        if (result.success) {
          // Update local state and trigger re-render
          originalAssignParticipant({ drawPosition, participantId });
        }
        return result;
      },
    });

    return { success: true };
  };

  // Override assignBye to use TMX mutations
  const originalAssignBye = baseManager.assignBye.bind(baseManager);
  baseManager.assignBye = ({ drawPosition }) => {
    // Direct assignment - factory handles replacement automatically
    const methods = [
      {
        method: 'assignDrawPositionBye',
        params: {
          drawId,
          structureId,
          drawPosition,
        },
      },
    ];

    mutationRequest({
      methods,
      callback: (result: any) => {
        if (result.success) {
          // Update local state and trigger re-render
          originalAssignBye({ drawPosition });
        }
        return result;
      },
    });

    return { success: true };
  };

  // Override assignQualifier to use TMX mutations
  const originalAssignQualifier = baseManager.assignQualifier.bind(baseManager);
  baseManager.assignQualifier = ({ drawPosition }) => {
    // Assign qualifier placeholder using factory
    const methods = [
      {
        method: 'assignDrawPosition',
        params: {
          drawId,
          structureId,
          drawPosition,
          qualifier: true,
        },
      },
    ];

    mutationRequest({
      methods,
      callback: (result: any) => {
        if (result.success) {
          // Update local state and trigger re-render
          originalAssignQualifier({ drawPosition });
        }
        return result;
      },
    });

    return { success: true };
  };

  // Override removeAssignment to use TMX mutations
  const originalRemoveAssignment = baseManager.removeAssignment.bind(baseManager);
  baseManager.removeAssignment = ({ drawPosition }) => {
    const methods = [
      {
        method: 'removeDrawPositionAssignment',
        params: {
          drawId,
          structureId,
          drawPosition,
        },
      },
    ];

    mutationRequest({
      methods,
      callback: (result: any) => {
        if (result.success) {
          // Update local state and trigger re-render
          originalRemoveAssignment({ drawPosition });
        }
        return result;
      },
    });

    return { success: true };
  };

  return baseManager;
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

  const matchUps = stateManager.getMatchUps();
  const eventData = tournamentEngine.getEventData({ eventId })?.eventData;
  const drawData = eventData?.drawsData?.find((d: any) => d.drawId === drawId);

  const display = drawData?.display || eventData?.eventInfo?.display || {};
  const compositionName = display?.compositionName;
  const composition = compositions[compositionName] || compositions.National;

  // Check if draw has qualifying structure
  const hasQualifying = drawData?.structures?.some((s: any) => s.stage === 'QUALIFYING');

  // Configure for inline assignment with persist mode
  const assignmentComposition = {
    ...composition,
    configuration: {
      ...composition.configuration,
      inlineAssignment: true,
      persistInputFields: env.persistInputFields, // From settings
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

      if (!result.success) {
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

      if (!result.success) {
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

      if (!result.success) {
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

      if (!result.success) {
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
      const inputToFocus = drawsView?.querySelector(
        `.participant-assignment-input[data-draw-position="${focusDrawPosition}"] input`
      ) as HTMLInputElement;

      if (inputToFocus) {
        inputToFocus.focus();
      }
    }, 100);
  } else {
    // Focus first input on initial render
    setTimeout(() => {
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
      label: 'Exit Assignment Mode',
      icon: 'fa fa-times-circle',
      onClick: () => exitParticipantAssignmentMode({ drawId, eventId, structureId }),
      intent: 'is-warning',
    },
  ];

  controlBar({ target: eventControlElement, items });
}

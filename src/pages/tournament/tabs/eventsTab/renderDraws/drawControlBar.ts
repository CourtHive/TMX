/**
 * Draw control bar with round tabs and playoff positioning.
 * Provides navigation, auto-positioning for playoffs, and round/view selection.
 */
import { drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getAdHocRoundOptions } from '../options/adHocRoundOptions';
import { controlBar } from 'components/controlBar/controlBar';
import { getRoundTabs } from '../options/getRoundTabs';
import { tmxToast } from 'services/notifications/tmxToast';

import { DRAW_CONTROL, LEFT, NONE, RIGHT } from 'constants/tmxConstants';
import { SET_POSITION_ASSIGNMENTS } from 'constants/mutationConstants';

const { MAIN, QUALIFYING, VOLUNTARY_CONSOLATION } = drawDefinitionConstants;
const AUTO_POSITION_PLAYOFF = 'autoPositionPlayoff';

export function drawControlBar({
  updateDisplay,
  existingView,
  structure,
  callback,
  drawId,
}: {
  callback?: (params: any) => void;
  updateDisplay?: () => void;
  existingView?: string;
  structure: any;
  drawId: string;
}): void {
  const drawControl = document.getElementById(DRAW_CONTROL);
  const { sourceStructuresComplete, hasDrawFeedProfile } = structure ?? {};
  const isPlayoff =
    !(structure?.stage === MAIN && structure?.stageSequence === 1) &&
    structure?.stage !== QUALIFYING &&
    hasDrawFeedProfile;
  const isAdHoc = tournamentEngine.isAdHoc({ structure });

  const drawControlItems: any[] = [];
  let controlInputs: any = null;

  if (isPlayoff) {
    const playoffPositioning = () => {
      const sourceStructureId = structure.sourceStructureIds[0];

      // Call automatedPlayoffPositioning locally first with applyPositioning: false
      const result = tournamentEngine.automatedPlayoffPositioning({
        structureId: sourceStructureId,
        applyPositioning: false,
        drawId,
      });

      if (!result.success || !result.structurePositionAssignments?.length) {
        tmxToast({
          message: result.error?.message || 'No position assignments generated',
          intent: 'is-warning',
        });
        return;
      }

      controlInputs.elements[AUTO_POSITION_PLAYOFF].style.display = NONE;

      // Now call setPositionAssignments via executionQueue
      const method = {
        params: {
          structurePositionAssignments: result.structurePositionAssignments,
          structureId: structure.structureId,
          drawId,
        },
        method: SET_POSITION_ASSIGNMENTS,
      };

      const postMutation = (mutationResult: any) => {
        if (mutationResult.success && typeof updateDisplay === 'function') {
          updateDisplay();
        } else if (mutationResult.error) {
          tmxToast({
            message: mutationResult.error.message || 'Failed to set positions',
            intent: 'is-danger',
          });
        }
      };

      mutationRequest({ methods: [method], callback: postMutation });
    };

    const hasAssignedPositions = structure.positionAssignments?.filter(
      ({ participantId }: any) => participantId,
    ).length;
    drawControlItems.push({
      intent: sourceStructuresComplete ? 'is-primary' : NONE,
      disabled: sourceStructuresComplete !== true,
      visible: !hasAssignedPositions,
      onClick: playoffPositioning,
      id: AUTO_POSITION_PLAYOFF,
      label: 'Auto position',
      location: RIGHT,
    });
  }

  const setDisplay = ({ refresh, view }: any) => typeof callback === 'function' && callback?.({ refresh, view });

  if (isAdHoc) {
    const adHocOptions = (getAdHocRoundOptions as any)({ structure, drawId, callback });
    drawControlItems.push(adHocOptions);
  }
  if (structure?.stage === VOLUNTARY_CONSOLATION) {
    console.log('voluntary controlBar with [View participants]');
  }

  const tabs = (getRoundTabs as any)({ structure, existingView, drawId, callback: setDisplay }).tabs;

  drawControlItems.push({
    onClick: () => setDisplay({ refresh: true, view: 'participants' }),
    id: 'roundDisplayTabs',
    location: LEFT,
    tabs,
  });

  if (drawControlItems.length && drawControl) {
    controlInputs = controlBar({ target: drawControl, items: drawControlItems });
  }
}

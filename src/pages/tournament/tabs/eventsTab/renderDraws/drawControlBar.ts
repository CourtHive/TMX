/**
 * Draw control bar with round tabs and playoff positioning.
 * Provides navigation, auto-positioning for playoffs, and round/view selection.
 */
import { drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getSwissRoundOptions } from '../options/swissRoundOptions';
import { getAdHocRoundOptions } from '../options/adHocRoundOptions';
import { tmxToast } from 'services/notifications/tmxToast';
import { getRoundTabs } from '../options/getRoundTabs';
import { controlBar } from 'courthive-components';

// constants
import { DRAW_CONTROL, LEFT, NONE, RIGHT } from 'constants/tmxConstants';
import { SET_POSITION_ASSIGNMENTS } from 'constants/mutationConstants';

const { MAIN, QUALIFYING, SWISS } = drawDefinitionConstants;
const AUTO_POSITION_PLAYOFF = 'autoPositionPlayoff';

export function drawControlBar({
  onInitialRoundChange,
  initialRoundNumber,
  updateDisplay,
  existingView,
  roundNumbers,
  structure,
  callback,
  drawId,
}: {
  onInitialRoundChange?: (roundNumber: number) => void;
  initialRoundNumber?: number;
  callback?: (params: any) => void;
  updateDisplay?: () => void;
  roundNumbers?: number[];
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
      style: { marginRight: '0.5em' },
    });
  }

  const setDisplay = ({ refresh, view }: any) => typeof callback === 'function' && callback?.({ refresh, view });

  if (isAdHoc && structure?.stage !== QUALIFYING) {
    const { drawDefinition } = tournamentEngine.getEvent({ drawId });
    const isSwiss = drawDefinition?.drawType === SWISS;
    const isAdHocDrawType = drawDefinition?.drawType === drawDefinitionConstants.AD_HOC;
    // Only show round-generation controls when the draw type is actually Swiss or AD_HOC.
    // An empty MAIN structure in qualifying-first mode has isAdHoc=true structurally, but the
    // draw type may be any (SE, RR, etc.) and needs full draw generation, not round generation.
    if (isSwiss || isAdHocDrawType) {
      if (isSwiss) {
        drawControlItems.push(getSwissRoundOptions({ structure, drawId, callback: callback ?? (() => {}) }));
      } else {
        drawControlItems.push((getAdHocRoundOptions as any)({ structure, drawId, callback }));
      }
    }
  }

  const isRoundRobin = structure?.structureType === drawDefinitionConstants.CONTAINER;
  const showRoundSelector =
    !isAdHoc && !isRoundRobin && roundNumbers && roundNumbers.length > 2 && onInitialRoundChange;

  if (showRoundSelector) {
    const roundName = (round: number): string => {
      const fromEnd = roundNumbers[roundNumbers.length - 1] - round;
      if (fromEnd === 0) return 'F';
      if (fromEnd === 1) return 'SF';
      if (fromEnd === 2) return 'QF';
      return `R${round}`;
    };

    const roundTabs = roundNumbers.map((rn) => ({
      label: roundName(rn),
      active: rn === (initialRoundNumber || 1),
      onClick: () => onInitialRoundChange(rn),
    }));

    drawControlItems.push({
      id: 'initialRoundTabs',
      location: RIGHT,
      tabs: roundTabs,
    });
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

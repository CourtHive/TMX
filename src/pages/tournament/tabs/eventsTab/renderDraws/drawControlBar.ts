/**
 * Draw control bar with round tabs and playoff positioning.
 * Provides navigation, auto-positioning for playoffs, and round/view selection.
 */
import { drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getAdHocRoundOptions } from '../options/adHocRoundOptions';
import { controlBar } from 'components/controlBar/controlBar';
import { getRoundTabs } from '../options/getRoundTabs';

import { AUTOMATED_PLAYOFF_POSITIONING } from 'constants/mutationConstants';
import { DRAW_CONTROL, LEFT, NONE, RIGHT } from 'constants/tmxConstants';

const { MAIN, QUALIFYING, VOLUNTARY_CONSOLATION } = drawDefinitionConstants;

export function drawControlBar({ updateDisplay, callback, structure, drawId, existingView }: { updateDisplay?: () => void; callback?: (params: any) => void; structure: any; drawId: string; existingView?: string }): void {
  const drawControl = document.getElementById(DRAW_CONTROL);
  const { sourceStructuresComplete, hasDrawFeedProfile } = structure ?? {};
  const isPlayoff =
    !(structure?.stage === MAIN && structure?.stageSequence === 1) &&
    structure?.stage !== QUALIFYING &&
    hasDrawFeedProfile;
  const isAdHoc = tournamentEngine.isAdHoc({ structure });

  const drawControlItems: any[] = [];

  if (isPlayoff) {
    const playoffPositioning = () => {
      const method = {
        params: { structureId: structure.sourceStructureIds[0], drawId },
        method: AUTOMATED_PLAYOFF_POSITIONING,
      };
      const postMutation = (result: any) => {
        if (result.success && typeof updateDisplay === 'function') updateDisplay();
      };
      mutationRequest({ methods: [method], callback: postMutation });
    };

    const hasAssignedPositions = structure.positionAssignments?.filter(({ participantId }: any) => participantId).length;
    drawControlItems.push({
      intent: sourceStructuresComplete ? 'is-primary' : NONE,
      disabled: sourceStructuresComplete !== true,
      visible: !hasAssignedPositions,
      onClick: playoffPositioning,
      label: 'Auto position',
      location: RIGHT,
    });
  }

  const setDisplay = ({ refresh, view }: any) => typeof callback === 'function' && callback && callback({ refresh, view });

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
    controlBar({ target: drawControl, items: drawControlItems });
  }
}

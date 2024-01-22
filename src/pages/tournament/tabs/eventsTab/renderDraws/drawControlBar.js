import { drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { getRoundDisplayOptions } from '../options/roundDisplayOptions';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getAdHocRoundOptions } from '../options/adHocRoundOptions';
import { controlBar } from 'components/controlBar/controlBar';

import { AUTOMATED_PLAYOFF_POSITIONING } from 'constants/mutationConstants';
import { DRAW_CONTROL, NONE, RIGHT } from 'constants/tmxConstants';

const { MAIN, QUALIFYING, CONTAINER, VOLUNTARY_CONSOLATION } = drawDefinitionConstants;

export function drawControlBar({ updateDisplay, callback, structure, drawId }) {
  const drawControl = document.getElementById(DRAW_CONTROL);
  const isRoundRobin = structure?.structureType === CONTAINER;
  const { sourceStructuresComplete, hasDrawFeedProfile } = structure ?? {};
  const isPlayoff =
    !(structure?.stage === MAIN && structure?.stageSequence === 1) &&
    structure?.stage !== QUALIFYING &&
    hasDrawFeedProfile;
  const isAdHoc = tournamentEngine.isAdHoc({ structure });

  if (isPlayoff) {
    const playoffPositioning = () => {
      const method = {
        params: { structureId: structure.sourceStructureIds[0], drawId },
        method: AUTOMATED_PLAYOFF_POSITIONING,
      };
      const postMutation = (result) => {
        if (result.success && typeof updateDisplay === 'function') updateDisplay();
      };
      mutationRequest({ methods: [method], callback: postMutation });
    };

    const hasAssignedPositions = structure.positionAssignments?.filter(({ participantId }) => participantId).length;
    const drawControlItems = [
      {
        intent: sourceStructuresComplete ? 'is-primary' : NONE,
        disabled: sourceStructuresComplete !== true,
        visible: !hasAssignedPositions,
        onClick: playoffPositioning,
        label: 'Auto position',
        location: RIGHT,
      },
    ];
    controlBar({ target: drawControl, items: drawControlItems });
  } else if (isRoundRobin) {
    // when all matcheUps have been scored (structure is complete) auto-switch to finishing position/stats view
    // if there are playoff structures, button to populate them
    const roundRobinStats = {
      onClick: () => console.log('boo'),
      label: 'View stats', // also toggle between finishing positions and matches
      location: RIGHT,
    };

    const drawControlItems = [roundRobinStats];
    controlBar({ target: drawControl, items: drawControlItems });
  } else if (isAdHoc) {
    const adHocOptions = getAdHocRoundOptions({ structure, drawId, callback });
    const setDisplay = ({ refresh, view }) => callback({ refresh, view });
    const displayOptions = getRoundDisplayOptions({ structure, drawId, callback: setDisplay });
    const drawControlItems = [displayOptions, adHocOptions];
    controlBar({ target: drawControl, items: drawControlItems });
  } else if (structure?.stage === VOLUNTARY_CONSOLATION) {
    console.log('voluntary controlBar with [View participants]');
    // use modal with eligible players and selected players highlighted
  }
}

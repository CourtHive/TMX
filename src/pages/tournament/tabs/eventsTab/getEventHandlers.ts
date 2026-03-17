/**
 * Event handlers for draw view interactions.
 * Handles clicks on participants, scores, schedules, venues, and round headers.
 */
import { fixtures, tournamentEngine, participantConstants, tools } from 'tods-competition-factory';
import { selectPositionAction } from 'components/popovers/selectPositionAction';
import { handleRoundVisibilityClick } from './options/handleRoundVisibilityClick';
import { handleRoundHeaderClick } from './options/handleRoundHeaderClick';
import { openScorecard } from 'components/overlays/scorecard/scorecard';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { InlineScoringManager } from 'courthive-components';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';
import { matchUpActions } from 'components/popovers/matchUpActions';
import { getTargetAttribute } from 'services/dom/parentAndChild';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

const { TEAM } = participantConstants;

interface EventHandlersParams {
  callback: (params?: any) => void;
  composition?: any;
  drawId: string;
  eventData: any;
}

export function getEventHandlers({ callback, composition, drawId, eventData }: EventHandlersParams) {
  const matchUps = eventData?.drawsData?.flatMap(({ structures }: any) =>
    structures
      .flatMap((structure: any) => [
        ...[structure.structures?.flatMap((structure: any) => Object.values(structure.roundMatchUps || {}).flat())],
        ...Object.values(structure.roundMatchUps || {}).flat(),
      ])
      .filter(Boolean),
  );
  const matchUpsMap = tools.createMap(matchUps, 'matchUpId');
  const getMatchUp = (props: any) => {
    const matchUpId = getTargetAttribute(props.pointerEvent.target, 'tmx-m', 'id');
    return matchUpsMap[matchUpId];
  };

  const getSideNumber = (props: any) => parseInt(getTargetAttribute(props.pointerEvent.target, 'tmx-sd', 'sideNumber'));
  const getStructureId = (props: any) => getTargetAttribute(props.pointerEvent.target, 'tmx-str', 'id');
  const getRoundNumber = (props: any) => parseInt(getTargetAttribute(props.pointerEvent.target, 'tmx-rd', 'roundNumber'));

  const sideClick = (props: any) => {
    const matchUp = getMatchUp(props);
    if (!matchUp) return;

    const sideNumber = getSideNumber(props);

    const side = props.side || matchUp.sides?.find((side: any) => side.sideNumber === sideNumber);
    const drawPosition = side?.drawPosition || (sideNumber && matchUp.drawPositions?.[sideNumber - 1]);

    const { validActions: actions } =
      (matchUp.drawId &&
        tournamentEngine.positionActions({
          sideNumber: sideNumber || side?.sideNumber,
          structureId: matchUp?.structureId,
          matchUpId: matchUp?.matchUpId,
          drawId: matchUp?.drawId,
          drawPosition,
          policyDefinitions: {
            ...fixtures.policies.POLICY_POSITION_ACTIONS_UNRESTRICTED,
          },
        })) ||
      {};

    selectPositionAction({ ...props, actions, callback });
  };
  const scoreClick = (props: any) => {
    const sideNumber = getSideNumber(props);
    const matchUp = getMatchUp(props);
    if (!matchUp) return;

    const { validActions } =
      tournamentEngine.matchUpActions({
        matchUpId: matchUp.matchUpId,
        drawId: matchUp.drawId,
        sideNumber,
      }) || {};

    const readyToScore = validActions?.find(({ type }: any) => type === 'SCORE');

    if (readyToScore) {
      if (matchUp.matchUpType === TEAM) {
        const onClose = () => callback();
        const title = eventData?.eventInfo?.eventName;

        const { matchUpId, drawId } = matchUp;
        openScorecard({ title, drawId, matchUpId, onClose });
      } else {
        enterMatchUpScore({ matchUpId: readyToScore.payload.matchUpId, callback });
      }
    } else if (matchUp.matchUpStatus && !['TO_BE_PLAYED', 'COMPLETED', 'BYE'].includes(matchUp.matchUpStatus)) {
      // For non-terminal statuses (SUSPENDED, IN_PROGRESS, etc.) that don't have a SCORE action,
      // still allow opening the scoring modal to edit/clear the score
      enterMatchUpScore({ matchUpId: matchUp.matchUpId, callback });
    }
  };

  // Inline scoring: create manager when composition has inlineScoring config
  let inlineManager: InlineScoringManager | undefined;
  if (composition?.configuration?.inlineScoring) {
    inlineManager = new InlineScoringManager({
      onSubmit: ({ matchUpId: mId, matchUp: scoredMatchUp }) => {
        const { matchUpStatus, matchUpFormat, winningSide, score } = scoredMatchUp;
        // Map sets for the factory outcome — include point scores (factory accepts
        // both string and numeric values) but ensure they are always paired.
        const sets = (score?.sets || []).map((s: any) => ({
          setNumber: s.setNumber,
          side1Score: s.side1Score,
          side2Score: s.side2Score,
          ...(s.side1TiebreakScore != null && { side1TiebreakScore: s.side1TiebreakScore }),
          ...(s.side2TiebreakScore != null && { side2TiebreakScore: s.side2TiebreakScore }),
          ...(s.side1PointScore != null && s.side2PointScore != null && {
            side1PointScore: s.side1PointScore,
            side2PointScore: s.side2PointScore,
          }),
          ...(s.winningSide != null && { winningSide: s.winningSide }),
        }));
        const methods = [
          {
            method: SET_MATCHUP_STATUS,
            params: {
              allowChangePropagation: true,
              drawId: scoredMatchUp.drawId || drawId,
              outcome: {
                score: { sets },
                matchUpFormat,
                matchUpStatus,
                winningSide,
              },
              matchUpId: mId,
            },
          },
        ];
        // When a match completes (winningSide set), participants may advance —
        // trigger a full refresh so lucky draw highlighting and structural changes apply.
        const mutationCallback = (result: any) => callback({ ...result, refresh: !!winningSide });
        mutationRequest({ methods, callback: mutationCallback });
      },
    });

    // Pre-create engines for all ready-to-score matchUps
    for (const matchUp of matchUps || []) {
      if (matchUp?.readyToScore && !matchUp?.winningSide && matchUp?.matchUpFormat) {
        inlineManager.getOrCreate(matchUp.matchUpId, matchUp.matchUpFormat, matchUp);
      }
    }
  }

  const eventHandlers = {
    centerInfoClick: () => console.log('centerInfo click'),
    roundHeaderClick: (props: any) => {
      const roundNumber = getRoundNumber(props);
      const structureId = getStructureId(props);
      return handleRoundHeaderClick({
        pointerEvent: props.pointerEvent,
        roundNumber,
        structureId,
        eventData,
        callback,
        drawId,
      });
    },
    roundVisibilityClick: (props: any) => {
      const roundNumber = getRoundNumber(props);
      const structureId = getStructureId(props);
      handleRoundVisibilityClick({
        pointerEvent: props.pointerEvent,
        roundNumber,
        structureId,
        eventData,
        callback,
        drawId,
      });
    },
    scheduleClick: (props: any) => {
      if (props?.pointerEvent) {
        props.pointerEvent.stopPropagation();
        const matchUpId = getTargetAttribute(props.pointerEvent.target, 'tmx-m', 'id');
        const matchUp = matchUpsMap[matchUpId];
        matchUpActions({ pointerEvent: props.pointerEvent, matchUp, callback });
      }
    },
    venueClick: (props: any) => {
      const matchUp = getMatchUp(props);
      if (props?.pointerEvent && matchUp?.schedule?.venueId) {
        const venueId = matchUp.schedule.venueId;
        const address = tournamentEngine.findVenue({ venueId })?.venue?.addresses?.[0];
        const { latitude, longitude } = address || {};

        if (!latitude || !longitude) return;

        const google = `https://www.google.com/maps/@?api=1&map_action=map&center=${latitude}%2C${longitude}&zoom=18&basemap=satellite`;
        const bing = `https://bing.com/maps/default.aspx?cp=${latitude}~${longitude}&lvl=17&style=h`;
        const openMap = (provider: string) => {
          const url = provider && latitude && longitude && ((provider === 'google' && google) || bing);
          if (url) window.open(url, '_blank');
        };
        const venueOptions = [
          { heading: 'Venue Location' },
          { divider: 'divider' },
          {
            onClick: () => openMap('google'),
            hide: !latitude || !longitude,
            text: 'Open in Google Maps',
          },
          {
            onClick: () => openMap('bing'),
            hide: !latitude || !longitude,
            text: 'Open in Bing Maps',
          },
        ];

        tipster({ items: venueOptions, target: props.pointerEvent.target, config: { placement: BOTTOM } });
      }
    },
    participantClick: sideClick,
    matchUpClick: scoreClick,
    scoreClick,
  };

  return { eventHandlers, inlineManager, matchUpsMap };
}

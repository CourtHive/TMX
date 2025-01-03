import { fixtures, tournamentEngine, participantConstants, tools } from 'tods-competition-factory';
import { selectPositionAction } from 'components/popovers/selectPositionAction';
import { handleRoundHeaderClick } from './options/handleRoundHeaderClick';
import { openScorecard } from 'components/overlays/scorecard/scorecard';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { matchUpActions } from 'components/popovers/matchUpActions';
import { getTargetAttribute } from 'services/dom/parentAndChild';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

const { TEAM } = participantConstants;

export function getEventHandlers({ callback, drawId, eventData }) {
  const matchUps = eventData?.drawsData?.flatMap(({ structures }) =>
    structures
      .flatMap((structure) => [
        ...[structure.structures?.flatMap((structure) => Object.values(structure.roundMatchUps || {}).flat())],
        ...Object.values(structure.roundMatchUps || {}).flat(),
      ])
      .filter(Boolean),
  );
  const matchUpsMap = tools.createMap(matchUps, 'matchUpId');
  const getMatchUp = (props) => {
    const matchUpId = getTargetAttribute(props.pointerEvent.target, 'tmx-m', 'id');
    return matchUpsMap[matchUpId];
  };

  const getSideNumber = (props) => parseInt(getTargetAttribute(props.pointerEvent.target, 'tmx-sd', 'sideNumber'));
  const getStructureId = (props) => getTargetAttribute(props.pointerEvent.target, 'tmx-str', 'id');
  const getRoundNumber = (props) => parseInt(getTargetAttribute(props.pointerEvent.target, 'tmx-rd', 'roundNumber'));

  const sideClick = (props) => {
    const matchUp = getMatchUp(props);
    const sideNumber = getSideNumber(props);

    const side = props.side || matchUp.sides?.find((side) => side.sideNumber === sideNumber);

    const { validActions: actions } =
      (matchUp.drawId &&
        tournamentEngine.positionActions({
          sideNumber: sideNumber || side?.sideNumber,
          structureId: matchUp?.structureId,
          drawPosition: side?.drawPosition,
          matchUpId: matchUp?.matchUpId,
          drawId: matchUp?.drawId,
          policyDefinitions: {
            positionActions: {
              // disableRoundRestrictions: true
            },
            ...fixtures.policies.POLICY_POSITION_ACTIONS_UNRESTRICTED,
          },
          // policyDefinitions: {
          // ...POLICY_POSITION_ACTIONS_UNRESTRICTED,
          //   ...(tournamentPolicies?.positionActions && { positionActions: tournamentPolicies?.positionActions }),
          //   ...{ seeding: tournamentPolicies?.seeding }
          // },
        })) ||
      {};

    selectPositionAction({ ...props, actions, callback });
  };
  const scoreClick = (props) => {
    const sideNumber = getSideNumber(props);
    const matchUp = getMatchUp(props);

    const { validActions } =
      tournamentEngine.matchUpActions({
        matchUpId: matchUp.matchUpId,
        drawId: matchUp.drawId,
        sideNumber,
      }) || {};

    const readyToScore = validActions?.find(({ type }) => type === 'SCORE');

    if (readyToScore) {
      if (matchUp.matchUpType === TEAM) {
        const onClose = () => callback();
        const title = eventData?.eventInfo?.eventName;

        const { matchUpId, drawId } = matchUp;
        openScorecard({ title, drawId, matchUpId, onClose });
      } else {
        enterMatchUpScore({ matchUpId: readyToScore.payload.matchUpId, callback });
      }
    }
  };

  return {
    centerInfoClick: () => console.log('centerInfo click'),
    roundHeaderClick: (props) => {
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
    scheduleClick: (props) => {
      if (props?.pointerEvent) {
        props.pointerEvent.stopPropagation();
        const matchUpId = getTargetAttribute(props.pointerEvent.target, 'tmx-m', 'id');
        const matchUp = matchUpsMap[matchUpId];
        matchUpActions({ pointerEvent: props.pointerEvent, matchUp, callback });
      }
    },
    venueClick: (props) => {
      const matchUp = getMatchUp(props);
      if (props?.pointerEvent && matchUp?.schedule?.venueId) {
        const venueId = matchUp.schedule.venueId;
        const address = tournamentEngine.findVenue({ venueId })?.venue?.addresses?.[0];
        const { latitude, longitude } = address || {};

        // NOTE: if there are other options not dependent on lat/long, remove following line
        if (!latitude || !longitude) return;

        const google = `https://www.google.com/maps/@?api=1&map_action=map&center=${latitude}%2C${longitude}&zoom=18&basemap=satellite`;
        const bing = `https://bing.com/maps/default.aspx?cp=${latitude}~${longitude}&lvl=17&style=h`;
        const openMap = (provider) => {
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
    // matchUpClick: (params) => console.log('matchUpClick', params),
    participantClick: sideClick,
    matchUpClick: scoreClick,
    scoreClick,
  };
}

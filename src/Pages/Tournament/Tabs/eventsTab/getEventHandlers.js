import { tournamentEngine, participantConstants } from 'tods-competition-factory';
import { selectPositionAction } from 'components/popovers/selectPositionAction';
import { openScorecard } from 'components/overlays/scorecard/scorecard';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { matchUpActions } from 'components/popovers/matchUpActions';
import { handleRoundHeaderClick } from './actions/adHocActions';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

const { TEAM } = participantConstants;

export function getEventHandlers({ eventData, callback }) {
  const sideClick = (props) => {
    const { matchUp = {}, sideNumber } = props;

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
            }
          }
          /*
            policyDefinitions: {
              ...POLICY_POSITION_ACTIONS_UNRESTRICTED,
              ...(tournamentPolicies?.positionActions && { positionActions: tournamentPolicies?.positionActions }),
              ...{ seeding: tournamentPolicies?.seeding }
            }
          */
        })) ||
      {};

    selectPositionAction({ ...props, actions, callback });
  };

  return {
    centerInfoClick: () => console.log('centerInfo click'),
    roundHeaderClick: (props) => handleRoundHeaderClick({ ...props, callback }),
    scheduleClick: (props) => {
      console.log('schedule click');
      if (props?.pointerEvent) {
        props.pointerEvent.stopPropagation();
        matchUpActions({ pointerEvent: props.pointerEvent, matchUp: props.matchUp, callback });
      }
    },
    venueClick: (props) => {
      console.log('venue click', props); // when no venueClick fall back to scheduleClick
      if (props?.pointerEvent && props.matchUp?.schedule?.venueId) {
        const venueId = props.matchUp.schedule.venueId;
        const address = tournamentEngine.findVenue({ venueId })?.venue?.addresses?.[0];
        const { latitude, longitude } = address || {};
        const google = `https://www.google.com/maps/@?api=1&map_action=map&center=${latitude}%2C${longitude}&zoom=18&basemap=satellite`;
        const bing = `https://bing.com/maps/default.aspx?cp=${latitude}~${longitude}&lvl=17&style=h`;
        const openMap = (provider) => {
          const url = provider && latitude && longitude && ((provider === 'google' && google) || bing);
          window.open(url, '_blank');
        };
        const venueOptions = [
          { heading: 'Venue Location' },
          { divider: 'divider' },
          {
            onClick: () => openMap('google'),
            text: 'Open in Google Maps'
          },
          {
            onClick: () => openMap('bing'),
            text: 'Open in Bing Maps'
          }
        ];

        tipster({ items: venueOptions, target: props.pointerEvent.target, config: { placement: BOTTOM } });
      }
    },
    matchUpClick: (params) => console.log('matchUpClick', params),
    scoreClick: (props) => {
      const { matchUp = {}, side, sideIndex } = props;
      const sideNumber = side?.sideNumber || sideIndex + 1;

      const { validActions: matchUpActions } =
        tournamentEngine.matchUpActions({
          matchUpId: matchUp.matchUpId,
          drawId: matchUp.drawId,
          sideNumber
          /*
            policyDefinitions: {
              [POLICY_TYPE_MATCHUP_ACTIONS]: {
                substituteAfterCompleted: true
                substituteWithoutScore: true,
              }
            }
          */
        }) || {};

      const readyToScore = matchUpActions?.find(({ type }) => type === 'SCORE');

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
    },
    participantClick: sideClick
  };
}

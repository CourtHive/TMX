import { drawDefinitionConstants } from 'tods-competition-factory';

const {
  AD_HOC,
  COMPASS,
  CURTIS,
  DOUBLE_ELIMINATION,
  /*
  // TODO: add configuration for FIC to achieve the following
  FEED_IN_CHAMPIONSHIP_TO_QF,
  FEED_IN_CHAMPIONSHIP_TO_R16,
  FEED_IN_CHAMPIONSHIP_TO_SF,
  MODIFIED_FEED_IN_CHAMPIONSHIP,
  */
  FEED_IN_CHAMPIONSHIP,
  FEED_IN,
  FIRST_MATCH_LOSER_CONSOLATION,
  FIRST_ROUND_LOSER_CONSOLATION,
  LUCKY_DRAW,
  OLYMPIC,
  PLAY_OFF,
  ROUND_ROBIN,
  ROUND_ROBIN_WITH_PLAYOFF,
  SINGLE_ELIMINATION
} = drawDefinitionConstants;

export function getDrawTypeOptions({ isPlayoff, isQualifying } = {}) {
  return [
    { label: 'Ad-hoc', value: AD_HOC, hide: isQualifying },
    { label: 'Compass', value: COMPASS, hide: isQualifying },
    { label: 'Curtis consolation', value: CURTIS, hide: isQualifying },
    { label: 'Double elimination', value: DOUBLE_ELIMINATION, hide: isPlayoff || isQualifying },
    { label: 'Elimination: fed consolation', value: FEED_IN_CHAMPIONSHIP, hide: isQualifying },
    { label: 'First match loser consolation', value: FIRST_MATCH_LOSER_CONSOLATION, hide: isQualifying },
    { label: 'First round loser consolation', value: FIRST_ROUND_LOSER_CONSOLATION, hide: isQualifying },
    { label: 'Lucky', value: LUCKY_DRAW, hide: isPlayoff || isQualifying },
    { label: 'Olympic', value: OLYMPIC, hide: isQualifying },
    { label: 'Playoff', value: PLAY_OFF, hide: isQualifying },
    { label: 'Round robin w/ playoff', value: ROUND_ROBIN_WITH_PLAYOFF, hide: isPlayoff || isQualifying },
    { label: 'Round robin', value: ROUND_ROBIN },
    { label: 'Single elimination', value: SINGLE_ELIMINATION },
    { label: 'Staggered Entry', value: FEED_IN, hide: isPlayoff || isQualifying }
  ];
}

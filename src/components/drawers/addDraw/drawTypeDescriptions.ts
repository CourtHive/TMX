/**
 * Maps draw type selector values to i18n description keys.
 */
import { drawDefinitionConstants } from 'tods-competition-factory';

import { DRAW_MATIC } from 'constants/tmxConstants';

const {
  AD_HOC,
  COMPASS,
  CURTIS,
  DOUBLE_ELIMINATION,
  FEED_IN_CHAMPIONSHIP,
  FEED_IN,
  FIRST_MATCH_LOSER_CONSOLATION,
  FIRST_ROUND_LOSER_CONSOLATION,
  LUCKY_DRAW,
  OLYMPIC,
  PAGE_PLAYOFF,
  PLAY_OFF,
  ROUND_ROBIN,
  ROUND_ROBIN_WITH_PLAYOFF,
  SINGLE_ELIMINATION,
} = drawDefinitionConstants;

const drawTypeToKey: Record<string, string> = {
  [SINGLE_ELIMINATION]: 'SINGLE_ELIMINATION',
  [ROUND_ROBIN]: 'ROUND_ROBIN',
  [DRAW_MATIC]: 'DRAW_MATIC',
  [AD_HOC]: 'AD_HOC',
  [COMPASS]: 'COMPASS',
  [CURTIS]: 'CURTIS',
  [DOUBLE_ELIMINATION]: 'DOUBLE_ELIMINATION',
  [FEED_IN_CHAMPIONSHIP]: 'FEED_IN_CHAMPIONSHIP',
  [FIRST_MATCH_LOSER_CONSOLATION]: 'FIRST_MATCH_LOSER_CONSOLATION',
  [FIRST_ROUND_LOSER_CONSOLATION]: 'FIRST_ROUND_LOSER_CONSOLATION',
  [LUCKY_DRAW]: 'LUCKY_DRAW',
  [OLYMPIC]: 'OLYMPIC',
  [PAGE_PLAYOFF]: 'PAGE_PLAYOFF',
  [PLAY_OFF]: 'PLAY_OFF',
  [ROUND_ROBIN_WITH_PLAYOFF]: 'ROUND_ROBIN_WITH_PLAYOFF',
  [FEED_IN]: 'FEED_IN',
};

export function getDrawTypeInfoKey(drawTypeValue: string): string {
  return drawTypeToKey[drawTypeValue] || drawTypeValue;
}

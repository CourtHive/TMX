/**
 * Get available draw type options based on context.
 * Filters draw types by playoff and qualifying flags.
 * Includes saved topology templates when the topology builder is enabled.
 */
import { getUserTopologiesSync } from 'pages/templates/topologyBridge';
import { drawDefinitionConstants } from 'tods-competition-factory';
import { getTopologyTemplates } from './topologyTemplates';

import { DRAW_MATIC, TOPOLOGY_TEMPLATE_PREFIX } from 'constants/tmxConstants';

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

export function getDrawTypeOptions({ isPlayoff, isQualifying }: { isPlayoff?: boolean; isQualifying?: boolean } = {}): any[] {
  const showTopology = !isPlayoff && !isQualifying;

  // Tournament-extension templates
  const tournamentTemplates = showTopology
    ? getTopologyTemplates().map((t) => ({
        label: `\u2726 ${t.name}`,
        value: `${TOPOLOGY_TEMPLATE_PREFIX}${t.name}`,
      }))
    : [];

  // User-saved templates from Dexie catalog
  const userCatalogTemplates = showTopology
    ? getUserTopologiesSync().map((t) => ({
        label: `\u2726 ${t.name}`,
        value: `${TOPOLOGY_TEMPLATE_PREFIX}${t.name}`,
      }))
    : [];

  // Merge, deduplicate by value
  const seen = new Set<string>();
  const templateOptions = [...tournamentTemplates, ...userCatalogTemplates].filter((t) => {
    if (seen.has(t.value)) return false;
    seen.add(t.value);
    return true;
  });

  // Common types first, then alphabetical built-ins, then user templates
  const common = [
    { label: 'Single elimination', value: SINGLE_ELIMINATION },
    { label: 'Round robin', value: ROUND_ROBIN },
    { label: 'DrawMatic', value: DRAW_MATIC, hide: isQualifying || isPlayoff },
  ];

  const builtIn = [
    { label: 'Ad-hoc', value: AD_HOC, hide: isQualifying },
    { label: 'Compass', value: COMPASS, hide: isQualifying },
    { label: 'Curtis consolation', value: CURTIS, hide: isQualifying },
    { label: 'Double elimination', value: DOUBLE_ELIMINATION, hide: isPlayoff || isQualifying },
    { label: 'Feed in championship', value: FEED_IN_CHAMPIONSHIP, hide: isQualifying },
    { label: 'First match loser consolation', value: FIRST_MATCH_LOSER_CONSOLATION, hide: isQualifying },
    { label: 'First round loser consolation', value: FIRST_ROUND_LOSER_CONSOLATION, hide: isQualifying },
    { label: 'Lucky', value: LUCKY_DRAW, hide: isPlayoff || isQualifying },
    { label: 'Olympic', value: OLYMPIC, hide: isQualifying },
    { label: 'Playoff', value: PLAY_OFF, hide: isQualifying },
    { label: 'Round robin w/ playoff', value: ROUND_ROBIN_WITH_PLAYOFF, hide: isPlayoff || isQualifying },
    { label: 'Staggered Entry', value: FEED_IN, hide: isPlayoff || isQualifying },
  ];

  const divider = { label: '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', disabled: true };

  return [
    ...common,
    divider,
    ...builtIn,
    ...(templateOptions.length ? [divider, ...templateOptions] : []),
  ];
}

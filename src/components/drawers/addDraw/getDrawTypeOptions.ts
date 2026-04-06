/**
 * Get available draw type options based on context.
 * Filters draw types by playoff and qualifying flags.
 * Includes saved topology templates when the topology builder is enabled.
 */
import { getUserTopologiesSync } from 'pages/templates/topologyBridge';
import { drawDefinitionConstants } from 'tods-competition-factory';
import { getTopologyTemplates } from './topologyTemplates';
import { validateTopology } from 'courthive-components';
import { providerConfig } from 'config/providerConfig';
import { t } from 'i18n';

// constants and types
import { DRAW_MATIC, TOPOLOGY_TEMPLATE_PREFIX } from 'constants/tmxConstants';
import type { TopologyTemplate } from 'courthive-components';

const {
  ADAPTIVE,
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
  PAGE_PLAYOFF,
  PLAY_OFF,
  ROUND_ROBIN,
  ROUND_ROBIN_WITH_PLAYOFF,
  SINGLE_ELIMINATION,
} = drawDefinitionConstants;

/** Returns true if the template's topology has no validation errors (warnings are OK). */
function isValidTemplate(template: TopologyTemplate | { state: TopologyTemplate['state'] }): boolean {
  if (!template.state?.nodes?.length) return false;
  const state = {
    drawName: template.state.drawName || '',
    nodes: template.state.nodes || [],
    edges: template.state.edges || [],
    selectedNodeId: null,
    selectedEdgeId: null,
  };
  const errors = validateTopology(state);
  return !errors.some((e) => e.severity === 'error');
}

export function getDrawTypeOptions({
  isPlayoff,
  isQualifying,
}: { isPlayoff?: boolean; isQualifying?: boolean } = {}): any[] {
  const showTopology = !isPlayoff && !isQualifying;

  // Tournament-extension templates (only validated/complete ones)
  const tournamentTemplates = showTopology
    ? getTopologyTemplates()
        .filter(isValidTemplate)
        .map((tpl) => ({
          label: `\u2726 ${tpl.name}`,
          value: `${TOPOLOGY_TEMPLATE_PREFIX}${tpl.name}`,
        }))
    : [];

  // User-saved templates from Dexie catalog (only validated/complete ones)
  const userCatalogTemplates = showTopology
    ? getUserTopologiesSync()
        .filter(isValidTemplate)
        .map((tpl) => ({
          label: `\u2726 ${tpl.name}`,
          value: `${TOPOLOGY_TEMPLATE_PREFIX}${tpl.name}`,
        }))
    : [];

  // Merge, deduplicate by value
  const seen = new Set<string>();
  const templateOptions = [...tournamentTemplates, ...userCatalogTemplates].filter((tpl) => {
    if (seen.has(tpl.value)) return false;
    seen.add(tpl.value);
    return true;
  });

  // Common types first, then alphabetical built-ins, then user templates
  const common = [
    { label: t('drawers.addDraw.drawTypeSingleElimination'), value: SINGLE_ELIMINATION },
    { label: t('drawers.addDraw.drawTypeRoundRobin'), value: ROUND_ROBIN },
    { label: t('drawers.addDraw.drawTypeDrawMatic'), value: DRAW_MATIC, hide: isQualifying || isPlayoff },
  ];

  const builtIn = [
    { label: t('drawers.addDraw.drawTypeAdaptive'), value: ADAPTIVE, hide: isPlayoff || isQualifying },
    { label: t('drawers.addDraw.drawTypeAdHoc'), value: AD_HOC, hide: isQualifying },
    { label: t('drawers.addDraw.drawTypeCompass'), value: COMPASS, hide: isQualifying },
    { label: t('drawers.addDraw.drawTypeCurtis'), value: CURTIS, hide: isQualifying },
    {
      label: t('drawers.addDraw.drawTypeDoubleElimination'),
      value: DOUBLE_ELIMINATION,
      hide: isPlayoff || isQualifying,
    },
    { label: t('drawers.addDraw.drawTypeFeedInChampionship'), value: FEED_IN_CHAMPIONSHIP, hide: isQualifying },
    { label: t('drawers.addDraw.drawTypeFirstMatchLoser'), value: FIRST_MATCH_LOSER_CONSOLATION, hide: isQualifying },
    { label: t('drawers.addDraw.drawTypeFirstRoundLoser'), value: FIRST_ROUND_LOSER_CONSOLATION, hide: isQualifying },
    { label: t('drawers.addDraw.drawTypeLucky'), value: LUCKY_DRAW, hide: isPlayoff || isQualifying },
    { label: t('drawers.addDraw.drawTypeOlympic'), value: OLYMPIC, hide: isQualifying },
    { label: t('drawers.addDraw.drawTypePagePlayoff'), value: PAGE_PLAYOFF, hide: !isPlayoff },
    { label: t('drawers.addDraw.drawTypePlayoff'), value: PLAY_OFF, hide: isQualifying },
    {
      label: t('drawers.addDraw.drawTypeRoundRobinWithPlayoff'),
      value: ROUND_ROBIN_WITH_PLAYOFF,
      hide: isPlayoff || isQualifying,
    },
    { label: t('drawers.addDraw.drawTypeStaggeredEntry'), value: FEED_IN, hide: isPlayoff || isQualifying },
  ];

  const divider = { label: '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', disabled: true };

  let allOptions = [...common, divider, ...builtIn, ...(templateOptions.length ? [divider, ...templateOptions] : [])];

  // Filter by provider-allowed draw types (if restricted)
  const allowedDrawTypes = providerConfig.getAllowedList('allowedDrawTypes');
  if (allowedDrawTypes.length) {
    allOptions = allOptions.filter((opt: any) => opt.disabled || !opt.value || allowedDrawTypes.includes(opt.value));
  }

  return allOptions;
}

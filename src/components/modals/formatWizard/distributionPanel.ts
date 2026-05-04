import { buildRatingDistributionChart } from 'courthive-components';
import { t } from 'i18n';

// constants and types
import { FORMAT_WIZARD_DISTRIBUTION, FORMAT_WIZARD_HEADER_DISTRIBUTION } from 'constants/tmxConstants';
import { RatingDistributionStats } from 'tods-competition-factory';

export interface DistributionPanelHandle {
  setData: (stats: RatingDistributionStats, summary: { rated: number; total: number; scale: string }) => void;
  element: HTMLElement;
}

const PANEL_STYLE = 'padding: 16px; border-bottom: 1px solid var(--tmx-border-secondary, #eee);';
const HEADER_STYLE =
  'font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tmx-text-secondary, #777); margin-bottom: 8px;';
const SUMMARY_STYLE = 'font-size: 12px; color: var(--tmx-text-secondary, #777); margin-top: 4px;';
// Width fills the available right-pane real estate up to 1000 px;
// past that the chart stops growing so labels stay readable on
// ultra-wide panes.
const CHART_HOLDER_STYLE = 'min-height: 200px; width: 100%; max-width: 1000px;';
const CHART_VIEWBOX_WIDTH = 1000;
const CHART_VIEWBOX_HEIGHT = 240;

export function buildDistributionPanel(): DistributionPanelHandle {
  const root = document.createElement('div');
  root.style.cssText = PANEL_STYLE;

  const header = document.createElement('div');
  header.id = FORMAT_WIZARD_HEADER_DISTRIBUTION;
  header.style.cssText = HEADER_STYLE;
  header.textContent = t('formatWizard.headers.distribution');
  root.appendChild(header);

  const chartHolder = document.createElement('div');
  chartHolder.id = FORMAT_WIZARD_DISTRIBUTION;
  chartHolder.style.cssText = CHART_HOLDER_STYLE;
  root.appendChild(chartHolder);

  const summary = document.createElement('div');
  summary.style.cssText = SUMMARY_STYLE;
  root.appendChild(summary);

  function setData(
    stats: RatingDistributionStats,
    info: { rated: number; total: number; scale: string },
  ): void {
    chartHolder.replaceChildren();
    if (stats.count > 0) {
      const chart = buildRatingDistributionChart(stats, {
        width: CHART_VIEWBOX_WIDTH,
        height: CHART_VIEWBOX_HEIGHT,
      });
      // Let the SVG's viewBox handle the scaling — width: 100% makes
      // it stretch to the panel; height: auto preserves the 800:220
      // aspect ratio so band labels don't crowd.
      chart.setAttribute('width', '100%');
      chart.style.width = '100%';
      chart.style.height = 'auto';
      chart.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      chartHolder.appendChild(chart);
    }
    summary.textContent =
      info.rated === 0
        ? t('formatWizard.summary.noRatedParticipants')
        : t('formatWizard.summary.ratedOf', { rated: info.rated, total: info.total, scale: info.scale.toUpperCase() });
  }

  return { setData, element: root };
}

/**
 * The menu behind the Entries view's Add draw split button (CA, 2026-11-17): the draw builder, then each valid template
 * saved on the tournament, opened in the builder to be fitted to the event. The button's own click keeps the drawer.
 */
import { getTopologyTemplates } from 'components/drawers/addDraw/topologyTemplates';
import { isValidTemplate } from 'components/drawers/addDraw/getDrawTypeOptions';
import { navigateToTopology } from 'pages/tournament/topologyPage';
import { escapeHtml } from 'utilities/escapeHtml';
import { t } from 'i18n';

export function addDrawMenu(eventId: string): any[] {
  const templates = getTopologyTemplates().filter(isValidTemplate);
  return [
    { label: t('pages.events.drawBuilder'), onClick: () => navigateToTopology({ eventId }), close: true },
    ...(templates.length ? [{ divider: true }, { heading: t('pages.events.savedTemplates') }] : []),
    ...templates.map((template) => ({
      label: `✦ ${escapeHtml(template.name)}`,
      onClick: () => navigateToTopology({ eventId, templateName: template.name }),
      close: true,
    })),
  ];
}

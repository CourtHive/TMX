import { showTMXtemplates } from 'services/transitions/screenSlaver';
import { removeAllChildNodes } from 'services/dom/transformers';
import { homeNavigation } from 'homeNavigation';
import { context } from 'services/context';
import { TMX_TEMPLATES, TEMPLATES } from 'constants/tmxConstants';

export function renderTemplatesPage(): void {
  showTMXtemplates();
  homeNavigation(TEMPLATES);

  const tmxButton = document.getElementById('provider');
  if (tmxButton) tmxButton.onclick = () => context.router?.navigate('/tournaments');

  const container = document.getElementById(TMX_TEMPLATES);
  if (!container) return;

  removeAllChildNodes(container);

  const placeholder = document.createElement('div');
  placeholder.className = 'flexcol flexcenter';
  placeholder.style.padding = '2em';
  placeholder.innerHTML = `
    <h2>Topology Templates</h2>
    <p>Manage reusable draw topology blueprints here.</p>
  `;
  container.appendChild(placeholder);
}

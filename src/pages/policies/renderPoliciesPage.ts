import { showTMXpolicies } from 'services/transitions/screenSlaver';
import { removeAllChildNodes } from 'services/dom/transformers';
import { homeNavigation } from 'homeNavigation';
import { context } from 'services/context';
import { TMX_POLICIES, POLICIES } from 'constants/tmxConstants';

export function renderPoliciesPage(): void {
  showTMXpolicies();
  homeNavigation(POLICIES);

  const tmxButton = document.getElementById('provider');
  if (tmxButton) tmxButton.onclick = () => context.router?.navigate('/tournaments');

  const container = document.getElementById(TMX_POLICIES);
  if (!container) return;

  removeAllChildNodes(container);

  const placeholder = document.createElement('div');
  placeholder.className = 'flexcol flexcenter';
  placeholder.style.padding = '2em';
  placeholder.innerHTML = `
    <h2>Policies</h2>
    <p>Manage reusable policy configurations (scheduling, scoring, seeding) here.</p>
  `;
  container.appendChild(placeholder);
}

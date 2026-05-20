import { showTMXpolicies } from 'services/transitions/screenSlaver';
import { removeAllChildNodes } from 'services/dom/transformers';
import { homeNavigation } from 'homeNavigation';
import { context } from 'services/context';
import { TMX_POLICIES, POLICIES } from 'constants/tmxConstants';
import { createPolicyCatalog } from 'courthive-components';
import type { PolicyCatalogControl } from 'courthive-components';
import { getBuiltinPolicies, loadUserPolicies, saveUserPolicy } from './policyBridge';
import './policyCatalog.css';

let catalogControl: PolicyCatalogControl | null = null;

export async function renderPoliciesPage(): Promise<void> {
  showTMXpolicies();
  homeNavigation(POLICIES);

  const container = document.getElementById(TMX_POLICIES);
  if (!container) return;

  removeAllChildNodes(container);

  if (catalogControl) {
    catalogControl.destroy();
    catalogControl = null;
  }

  container.appendChild(buildCatalogLink());

  const builtinPolicies = getBuiltinPolicies();
  const userPolicies = await loadUserPolicies();

  const catalogContainer = document.createElement('div');
  container.appendChild(catalogContainer);

  catalogControl = createPolicyCatalog(
    {
      builtinPolicies,
      userPolicies,
      onPolicySaved: (item) => saveUserPolicy(item),
    },
    catalogContainer,
  );
}

function buildCatalogLink(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'policy-catalog__entry';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'policy-catalog__entry-button';
  button.textContent = 'Browse public catalog →';
  button.addEventListener('click', () => {
    context.router?.navigate(`/${POLICIES}/catalog`);
  });
  wrap.appendChild(button);

  return wrap;
}

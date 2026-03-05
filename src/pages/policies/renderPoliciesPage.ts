import { showTMXpolicies } from 'services/transitions/screenSlaver';
import { removeAllChildNodes } from 'services/dom/transformers';
import { homeNavigation } from 'homeNavigation';
import { context } from 'services/context';
import { TMX_POLICIES, POLICIES } from 'constants/tmxConstants';
import { createPolicyCatalog } from 'courthive-components';
import type { PolicyCatalogControl } from 'courthive-components';
import { getBuiltinPolicies, loadUserPolicies, saveUserPolicy } from './policyBridge';

let catalogControl: PolicyCatalogControl | null = null;

export async function renderPoliciesPage(): Promise<void> {
  showTMXpolicies();
  homeNavigation(POLICIES);

  const tmxButton = document.getElementById('provider');
  if (tmxButton) tmxButton.onclick = () => context.router?.navigate('/tournaments');

  const container = document.getElementById(TMX_POLICIES);
  if (!container) return;

  removeAllChildNodes(container);

  if (catalogControl) {
    catalogControl.destroy();
    catalogControl = null;
  }

  const userPolicies = await loadUserPolicies();

  catalogControl = createPolicyCatalog(
    {
      builtinPolicies: getBuiltinPolicies(),
      userPolicies,
      onPolicySaved: (item) => saveUserPolicy(item),
    },
    container,
  );
}

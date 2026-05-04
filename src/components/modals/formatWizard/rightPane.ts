import { buildDistributionPanel } from './distributionPanel';
import { buildPlanCard } from './planCard';
import { t } from 'i18n';

// constants and types
import {
  FORMAT_WIZARD_EMPTY,
  FORMAT_WIZARD_HEADER_PLANS,
  FORMAT_WIZARD_PLAN_LIST,
  FORMAT_WIZARD_RIGHT_PANE,
} from 'constants/tmxConstants';
import { RunFormatWizardResult } from 'services/formatWizard';

export interface RightPaneHandle {
  setData: (result: RunFormatWizardResult) => void;
  setEmpty: (message: string) => void;
  element: HTMLElement;
}

const RIGHT_PANE_STYLE = 'flex: 1; display: flex; flex-direction: column; min-height: 320px; background: var(--tmx-bg-secondary, #fafafa);';
const PLAN_LIST_SECTION_STYLE = 'padding: 16px; flex: 1; overflow-y: auto;';
const HEADER_STYLE =
  'font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tmx-text-secondary, #777); margin-bottom: 8px;';
const PLAN_LIST_STYLE = 'display: flex; flex-direction: column; gap: 8px;';
const EMPTY_STYLE =
  'padding: 32px 16px; color: var(--tmx-text-muted, #999); font-style: italic; text-align: center;';

function buildHeader(idValue: string, key: string): HTMLDivElement {
  const header = document.createElement('div');
  header.id = idValue;
  header.style.cssText = HEADER_STYLE;
  header.textContent = t(key);
  return header;
}

// Builds the right-pane container with a distribution-chart panel
// at the top and a ranked plan card list below. Returns a handle
// the caller can use to push fresh wizard results in (live
// recompute) or set an empty/error state.
export function buildRightPane(): RightPaneHandle {
  const root = document.createElement('div');
  root.id = FORMAT_WIZARD_RIGHT_PANE;
  root.className = 'tmx-format-wizard-right-pane';
  root.style.cssText = RIGHT_PANE_STYLE;

  const distributionPanel = buildDistributionPanel();
  root.appendChild(distributionPanel.element);

  const plansSection = document.createElement('div');
  plansSection.style.cssText = PLAN_LIST_SECTION_STYLE;
  plansSection.appendChild(buildHeader(FORMAT_WIZARD_HEADER_PLANS, 'formatWizard.headers.plans'));

  const planList = document.createElement('div');
  planList.id = FORMAT_WIZARD_PLAN_LIST;
  planList.style.cssText = PLAN_LIST_STYLE;
  plansSection.appendChild(planList);

  const empty = document.createElement('div');
  empty.id = FORMAT_WIZARD_EMPTY;
  empty.style.cssText = EMPTY_STYLE;
  empty.hidden = true;
  plansSection.appendChild(empty);

  root.appendChild(plansSection);

  function setData(result: RunFormatWizardResult): void {
    distributionPanel.setData(result.distribution, {
      rated: result.ratedParticipants,
      total: result.totalParticipants,
      scale: result.appliedScale,
    });

    if (result.plans.length === 0) {
      planList.replaceChildren();
      empty.hidden = false;
      empty.textContent = result.error
        ? t(`formatWizard.summary.${result.error === 'INSUFFICIENT_RATED_PARTICIPANTS' ? 'noRatedParticipants' : 'constraintsRequired'}`)
        : t('formatWizard.summary.constraintsRequired');
      return;
    }

    empty.hidden = true;
    const cards = result.plans.map(buildPlanCard);
    planList.replaceChildren(...cards);
  }

  function setEmpty(message: string): void {
    planList.replaceChildren();
    empty.hidden = false;
    empty.textContent = message;
  }

  return { setData, setEmpty, element: root };
}

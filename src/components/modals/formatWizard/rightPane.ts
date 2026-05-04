import { buildPlanCard, buildStalePlaceholderCard } from './planCard';
import { buildDistributionPanel } from './distributionPanel';
import { t } from 'i18n';

// constants and types
import {
  FORMAT_WIZARD_CONSIDERATION,
  FORMAT_WIZARD_EMPTY,
  FORMAT_WIZARD_HEADER_CONSIDERATION,
  FORMAT_WIZARD_HEADER_PLANS,
  FORMAT_WIZARD_PLAN_LIST,
  FORMAT_WIZARD_RIGHT_PANE,
} from 'constants/tmxConstants';
import { RankedPlan } from 'tods-competition-factory';
import { RunFormatWizardResult } from 'services/formatWizard';

export interface SetDataOptions {
  targetMatchesPerPlayer?: number;
  consideredFingerprints?: string[];
  fingerprintForPlan?: (plan: RankedPlan) => string;
}

export interface RightPaneHandle {
  setOnApply: (cb: (plan: RankedPlan) => void) => void;
  setOnToggleConsider: (cb: (plan: RankedPlan, fingerprint: string) => void) => void;
  setOnRemoveStale: (cb: (fingerprint: string) => void) => void;
  setData: (result: RunFormatWizardResult, options?: SetDataOptions) => void;
  setEmpty: (message: string) => void;
  element: HTMLElement;
}

const RIGHT_PANE_STYLE =
  'flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: auto; background: var(--tmx-bg-secondary, #fafafa);';
const PLAN_LIST_SECTION_STYLE = 'padding: 16px; flex: 1;';
const HEADER_STYLE =
  'font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tmx-text-secondary, #777); margin-bottom: 8px;';
const CONSIDERATION_SECTION_STYLE =
  'padding: 16px; border-bottom: 1px solid var(--tmx-border-secondary, #eee); background: var(--tmx-bg-primary, #fff);';
const CONSIDERATION_LANE_STYLE = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px;';
const BAND_GROUP_STYLE = 'display: flex; flex-direction: column; gap: 8px;';
const BAND_HEADER_ROW_STYLE =
  'display: flex; align-items: baseline; gap: 8px; padding-top: 8px; padding-bottom: 4px; border-top: 1px solid var(--tmx-border-secondary, #e5e5e5);';
const BAND_HEADER_ROW_FIRST_STYLE = 'display: flex; align-items: baseline; gap: 8px; padding-bottom: 4px;';
const BAND_HEADING_STYLE = 'font-size: 13px; font-weight: 600; color: var(--tmx-text-primary, #222);';
const BAND_TARGET_TAG_STYLE =
  'font-size: 10px; padding: 1px 6px; border-radius: 999px; background: var(--tmx-accent-teal, #00b8a9); color: #fff; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;';
// Responsive 2-column grid; reflows to a single column when the
// pane is narrower than ~720 px.
const BAND_GRID_STYLE = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 12px;';
const PLAN_LIST_OUTER_STYLE = 'display: flex; flex-direction: column; gap: 16px;';
const EMPTY_STYLE = 'padding: 32px 16px; color: var(--tmx-text-muted, #999); font-style: italic; text-align: center;';

function buildHeader(idValue: string, key: string): HTMLDivElement {
  const header = document.createElement('div');
  header.id = idValue;
  header.style.cssText = HEADER_STYLE;
  header.textContent = t(key);
  return header;
}

// Group plans by their integer minMatchesPerPlayer, then render
// bands ordered: target band first, then bands above target
// (ascending), then bands below target (descending). The visual
// barrier is the band-header row's top border.
function orderBandKeys(keys: number[], target: number | undefined): number[] {
  const sorted = [...keys].sort((a, b) => a - b);
  if (typeof target !== 'number' || !sorted.includes(target)) {
    // No explicit target — order by descending matches-per-player
    // (more matches generally = stronger event experience).
    return sorted.slice().reverse();
  }
  const above = sorted.filter((k) => k > target);
  const below = sorted.filter((k) => k < target).reverse();
  return [target, ...above, ...below];
}

function groupPlansByMatchCount(plans: RankedPlan[]): Map<number, RankedPlan[]> {
  const groups = new Map<number, RankedPlan[]>();
  for (const plan of plans) {
    const key = Math.round(plan.aggregate.minMatchesPerPlayer);
    const list = groups.get(key) ?? [];
    list.push(plan);
    groups.set(key, list);
  }
  return groups;
}

function buildBandHeader(matchesPerPlayer: number, isTarget: boolean, isFirst: boolean): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'tmx-format-wizard-band-header';
  row.dataset.matchesPerPlayer = String(matchesPerPlayer);
  row.style.cssText = isFirst ? BAND_HEADER_ROW_FIRST_STYLE : BAND_HEADER_ROW_STYLE;

  const heading = document.createElement('span');
  heading.style.cssText = BAND_HEADING_STYLE;
  const key = matchesPerPlayer === 1 ? 'formatWizard.card.bandHeading' : 'formatWizard.card.bandHeading_plural';
  heading.textContent = t(key, { count: matchesPerPlayer });
  row.appendChild(heading);

  if (isTarget) {
    const tag = document.createElement('span');
    tag.className = 'tmx-format-wizard-band-target-tag';
    tag.style.cssText = BAND_TARGET_TAG_STYLE;
    tag.textContent = t('formatWizard.card.bandTargetTag');
    row.appendChild(tag);
  }

  return row;
}

interface BuildBandGroupArgs {
  matchesPerPlayer: number;
  bandPlans: RankedPlan[];
  isTarget: boolean;
  isFirst: boolean;
  consideredFingerprints: Set<string>;
  fingerprintFor: ((plan: RankedPlan) => string) | undefined;
  onApply: ((plan: RankedPlan) => void) | undefined;
  onToggleConsider: ((plan: RankedPlan, fingerprint: string) => void) | undefined;
}

function buildBandGroup(args: BuildBandGroupArgs): HTMLDivElement {
  const { matchesPerPlayer, bandPlans, isTarget, isFirst, consideredFingerprints, fingerprintFor } = args;
  const group = document.createElement('div');
  group.className = 'tmx-format-wizard-band-group';
  group.dataset.matchesPerPlayer = String(matchesPerPlayer);
  group.style.cssText = BAND_GROUP_STYLE;

  group.appendChild(buildBandHeader(matchesPerPlayer, isTarget, isFirst));

  const grid = document.createElement('div');
  grid.style.cssText = BAND_GRID_STYLE;
  for (const plan of bandPlans) {
    const fp = fingerprintFor ? fingerprintFor(plan) : undefined;
    const selected = fp ? consideredFingerprints.has(fp) : false;
    grid.appendChild(
      buildPlanCard(plan, {
        onApply: args.onApply ? (p) => args.onApply!(p) : undefined,
        onToggleConsider:
          args.onToggleConsider && fp ? (p) => args.onToggleConsider!(p, fp) : undefined,
        selected,
      }),
    );
  }
  group.appendChild(grid);

  return group;
}

// Builds the right-pane container with a distribution-chart panel
// at the top, a "Under consideration" lane, and a banded ranked
// plan list below. Returns a handle the caller uses to push fresh
// wizard results in (live recompute) or set an empty / error state.
export function buildRightPane(): RightPaneHandle {
  const root = document.createElement('div');
  root.id = FORMAT_WIZARD_RIGHT_PANE;
  root.className = 'tmx-format-wizard-right-pane';
  root.style.cssText = RIGHT_PANE_STYLE;

  const distributionPanel = buildDistributionPanel();
  root.appendChild(distributionPanel.element);

  // Consideration section — hidden by default, shown when the user
  // has pinned at least one plan. Lives above the bands so the
  // current selection is always visible while scrolling the bands.
  const considerationSection = document.createElement('div');
  considerationSection.style.cssText = CONSIDERATION_SECTION_STYLE;
  considerationSection.hidden = true;
  considerationSection.appendChild(buildHeader(FORMAT_WIZARD_HEADER_CONSIDERATION, 'formatWizard.headers.consideration'));
  const considerationLane = document.createElement('div');
  considerationLane.id = FORMAT_WIZARD_CONSIDERATION;
  considerationLane.style.cssText = CONSIDERATION_LANE_STYLE;
  considerationSection.appendChild(considerationLane);
  root.appendChild(considerationSection);

  const plansSection = document.createElement('div');
  plansSection.style.cssText = PLAN_LIST_SECTION_STYLE;
  plansSection.appendChild(buildHeader(FORMAT_WIZARD_HEADER_PLANS, 'formatWizard.headers.plans'));

  const planList = document.createElement('div');
  planList.id = FORMAT_WIZARD_PLAN_LIST;
  planList.style.cssText = PLAN_LIST_OUTER_STYLE;
  plansSection.appendChild(planList);

  const empty = document.createElement('div');
  empty.id = FORMAT_WIZARD_EMPTY;
  empty.style.cssText = EMPTY_STYLE;
  empty.hidden = true;
  plansSection.appendChild(empty);

  root.appendChild(plansSection);

  let onApply: ((plan: RankedPlan) => void) | undefined;
  let onToggleConsider: ((plan: RankedPlan, fingerprint: string) => void) | undefined;
  let onRemoveStale: ((fingerprint: string) => void) | undefined;

  function renderConsiderationLane(args: {
    plans: RankedPlan[];
    fingerprints: string[];
    fingerprintFor: ((plan: RankedPlan) => string) | undefined;
  }): void {
    const { plans, fingerprints, fingerprintFor } = args;
    if (fingerprints.length === 0 || !fingerprintFor) {
      considerationSection.hidden = true;
      considerationLane.replaceChildren();
      return;
    }
    const planByFingerprint = new Map<string, RankedPlan>();
    for (const plan of plans) planByFingerprint.set(fingerprintFor(plan), plan);

    const cards: HTMLElement[] = [];
    for (const fp of fingerprints) {
      const live = planByFingerprint.get(fp);
      if (live) {
        cards.push(
          buildPlanCard(live, {
            onApply: onApply ? (p) => onApply!(p) : undefined,
            onToggleConsider: onToggleConsider ? (p) => onToggleConsider!(p, fp) : undefined,
            selected: true,
          }),
        );
      } else {
        cards.push(buildStalePlaceholderCard({ fingerprint: fp, onRemove: () => onRemoveStale?.(fp) }));
      }
    }
    considerationSection.hidden = false;
    considerationLane.replaceChildren(...cards);
  }

  function setData(result: RunFormatWizardResult, options: SetDataOptions = {}): void {
    distributionPanel.setData(result.distribution, {
      rated: result.ratedParticipants,
      total: result.totalParticipants,
      scale: result.appliedScale,
    });

    const considered = options.consideredFingerprints ?? [];
    const fingerprintFor = options.fingerprintForPlan;
    const consideredSet = new Set(considered);

    if (result.plans.length === 0) {
      planList.replaceChildren();
      empty.hidden = false;
      empty.textContent = result.error
        ? t(`formatWizard.summary.${result.error === 'INSUFFICIENT_RATED_PARTICIPANTS' ? 'noRatedParticipants' : 'constraintsRequired'}`)
        : t('formatWizard.summary.constraintsRequired');
      renderConsiderationLane({ plans: [], fingerprints: considered, fingerprintFor });
      return;
    }

    empty.hidden = true;
    const target = options.targetMatchesPerPlayer;
    const groups = groupPlansByMatchCount(result.plans);
    const orderedKeys = orderBandKeys([...groups.keys()], target);
    const groupNodes = orderedKeys.map((key, i) =>
      buildBandGroup({
        matchesPerPlayer: key,
        bandPlans: groups.get(key) ?? [],
        isTarget: typeof target === 'number' && key === target,
        isFirst: i === 0,
        consideredFingerprints: consideredSet,
        fingerprintFor,
        onApply,
        onToggleConsider,
      }),
    );
    planList.replaceChildren(...groupNodes);

    renderConsiderationLane({ plans: result.plans, fingerprints: considered, fingerprintFor });
  }

  function setEmpty(message: string): void {
    planList.replaceChildren();
    empty.hidden = false;
    empty.textContent = message;
  }

  function setOnApply(cb: (plan: RankedPlan) => void): void {
    onApply = cb;
  }

  function setOnToggleConsider(cb: (plan: RankedPlan, fingerprint: string) => void): void {
    onToggleConsider = cb;
  }

  function setOnRemoveStale(cb: (fingerprint: string) => void): void {
    onRemoveStale = cb;
  }

  return { setOnApply, setOnToggleConsider, setOnRemoveStale, setData, setEmpty, element: root };
}

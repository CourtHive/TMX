import { t } from 'i18n';

// constants and types
import { PlanWarning, RankedPlan } from 'tods-competition-factory';

const APPLY_BUTTON_CLASS = 'tmx-format-wizard-apply-btn';
const TRASH_BUTTON_CLASS = 'tmx-format-wizard-trash-btn';

const CARD_STYLE_BASE =
  'border: 1px solid var(--tmx-border-secondary, #eee); border-radius: 6px; background: var(--tmx-bg-primary, #fff); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; cursor: pointer;';
const CARD_STYLE_SELECTED =
  'border: 2px solid var(--tmx-accent-teal, #00b8a9); border-radius: 6px; background: var(--tmx-bg-primary, #fff); padding: 11px 13px; display: flex; flex-direction: column; gap: 8px; cursor: pointer; box-shadow: 0 0 0 1px var(--tmx-accent-teal, #00b8a9) inset;';
const CARD_STYLE_STALE =
  'border: 2px solid var(--tmx-error-text, #d63031); border-radius: 6px; background: var(--tmx-bg-primary, #fff); padding: 11px 13px; display: flex; flex-direction: column; gap: 8px; opacity: 0.85;';
const TOP_ROW_STYLE = 'display: flex; align-items: center; gap: 8px;';
const RANK_BADGE_STYLE =
  'min-width: 26px; height: 26px; border-radius: 50%; background: var(--tmx-accent-teal, #00b8a9); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600;';
const ARCHETYPE_STYLE = 'font-size: 14px; font-weight: 600; color: var(--tmx-text-primary, #222); flex: 1;';
const VARIANT_STYLE = 'font-size: 12px; color: var(--tmx-text-secondary, #777);';
const VC_TAG_STYLE =
  'font-size: 10px; padding: 1px 6px; border-radius: 999px; background: var(--tmx-accent-teal, #00b8a9); color: #fff; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;';
const STALE_TAG_STYLE =
  'font-size: 10px; padding: 1px 6px; border-radius: 999px; background: var(--tmx-error-text, #d63031); color: #fff; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;';
const CONSIDER_TAG_STYLE =
  'font-size: 10px; padding: 1px 6px; border-radius: 999px; background: var(--tmx-accent-teal, #00b8a9); color: #fff; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;';
const FLIGHTS_LINE_STYLE = 'font-size: 12px; color: var(--tmx-text-secondary, #555);';
const NUMBERS_ROW_STYLE = 'display: flex; gap: 16px; flex-wrap: wrap;';
const NUMBER_BLOCK_STYLE = 'display: flex; flex-direction: column; min-width: 96px;';
const NUMBER_VALUE_STYLE = 'font-size: 18px; font-weight: 600; color: var(--tmx-text-primary, #222); line-height: 1.1;';
const NUMBER_LABEL_STYLE =
  'font-size: 11px; color: var(--tmx-text-secondary, #777); text-transform: uppercase; letter-spacing: 0.04em;';
const WARNINGS_ROW_STYLE = 'display: flex; flex-wrap: wrap; gap: 6px;';
const WARNING_CHIP_STYLE_BASE =
  'font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 500; background: var(--tmx-warning-bg, #fff3cd); color: var(--tmx-warning-text, #856404);';
const FOOTER_ROW_STYLE = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px;';
const SCORE_FOOTER_STYLE = 'font-size: 11px; color: var(--tmx-text-muted, #999);';
const APPLY_BUTTON_STYLE =
  'background: var(--tmx-accent-teal, #00b8a9); color: #fff; border: none; border-radius: 4px; padding: 6px 12px; font-size: 13px; font-weight: 500; cursor: pointer;';
const TRASH_BUTTON_STYLE =
  'background: none; color: var(--tmx-error-text, #d63031); border: 1px solid var(--tmx-error-text, #d63031); border-radius: 4px; padding: 4px 10px; font-size: 12px; cursor: pointer;';

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '–';
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${hours.toFixed(1)}h`;
}

// Matches per player is the structural guarantee — always an
// integer. Withdrawal risk is surfaced as a separate chip rather
// than fudged into a fractional number.
function formatMatchesPerPlayer(value: number): string {
  if (!Number.isFinite(value)) return '–';
  return String(Math.round(value));
}

function flightSummary(plan: RankedPlan): string {
  const flights = plan.flightStructures;
  if (flights.length === 0) return '';
  const sizes = flights.map((fs) => fs.flight.participantIds.length);
  const distinct = new Set(sizes);
  const flightCountKey = flights.length === 1 ? 'formatWizard.card.flightCount' : 'formatWizard.card.flightCount_plural';
  const countLabel = t(flightCountKey, { count: flights.length });
  if (distinct.size === 1) return `${countLabel} × ${sizes[0]}`;
  return `${countLabel} (${sizes.join(' / ')})`;
}

function buildNumberBlock(value: string, label: string): HTMLDivElement {
  const block = document.createElement('div');
  block.style.cssText = NUMBER_BLOCK_STYLE;
  const valueEl = document.createElement('span');
  valueEl.style.cssText = NUMBER_VALUE_STYLE;
  valueEl.textContent = value;
  const labelEl = document.createElement('span');
  labelEl.style.cssText = NUMBER_LABEL_STYLE;
  labelEl.textContent = label;
  block.appendChild(valueEl);
  block.appendChild(labelEl);
  return block;
}

function buildWarningChips(warnings: PlanWarning[]): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = WARNINGS_ROW_STYLE;
  for (const warning of warnings) {
    const chip = document.createElement('span');
    chip.className = 'tmx-format-wizard-warning-chip';
    chip.dataset.warning = warning;
    chip.style.cssText = WARNING_CHIP_STYLE_BASE;
    chip.textContent = t(`formatWizard.warnings.${warning}`);
    row.appendChild(chip);
  }
  return row;
}

// Renders a single ranked plan as a card. Layout: archetype banner
// (with optional VC / stale / consider tags) + flighting summary +
// three big numbers + warning chips + apply-button + de-emphasized
// score footer.
//
// `selected` paints a teal border + "consider" tag and reflects
// the user's intent to keep the plan around in the lane.
// `stale` paints a red border + trash icon — used by the
// consideration lane when a pinned plan no longer appears in the
// current results.
export interface PlanCardOptions {
  onApply?: (plan: RankedPlan) => void;
  onToggleConsider?: (plan: RankedPlan) => void;
  onRemoveStale?: () => void;
  selected?: boolean;
  stale?: boolean;
}

export function buildPlanCard(plan: RankedPlan, options: PlanCardOptions = {}): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'tmx-format-wizard-plan-card';
  card.dataset.rank = String(plan.rank);
  if (options.selected) card.dataset.selected = 'true';
  if (options.stale) card.dataset.stale = 'true';
  card.style.cssText = options.stale ? CARD_STYLE_STALE : options.selected ? CARD_STYLE_SELECTED : CARD_STYLE_BASE;

  if (options.onToggleConsider) {
    card.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      // Apply / trash buttons handle their own clicks.
      if (target.closest(`.${APPLY_BUTTON_CLASS}, .${TRASH_BUTTON_CLASS}`)) return;
      options.onToggleConsider!(plan);
    });
  }

  const topRow = document.createElement('div');
  topRow.style.cssText = TOP_ROW_STYLE;

  const rankBadge = document.createElement('span');
  rankBadge.className = 'tmx-format-wizard-plan-rank';
  rankBadge.style.cssText = RANK_BADGE_STYLE;
  rankBadge.textContent = String(plan.rank);
  topRow.appendChild(rankBadge);

  const firstStructure = plan.flightStructures[0]?.structure;
  const archetypeText = firstStructure?.kind ?? '';
  const archetype = document.createElement('span');
  archetype.className = 'tmx-format-wizard-plan-archetype';
  archetype.style.cssText = ARCHETYPE_STYLE;
  archetype.textContent = archetypeText.replace(/_/g, ' ');
  topRow.appendChild(archetype);

  if (firstStructure?.variantId) {
    const variant = document.createElement('span');
    variant.style.cssText = VARIANT_STYLE;
    variant.textContent = firstStructure.variantId;
    topRow.appendChild(variant);
  }

  if (firstStructure?.voluntaryConsolation) {
    const vcTag = document.createElement('span');
    vcTag.className = 'tmx-format-wizard-vc-tag';
    vcTag.style.cssText = VC_TAG_STYLE;
    vcTag.textContent = t('formatWizard.card.vcTag');
    topRow.appendChild(vcTag);
  }

  if (options.stale) {
    const staleTag = document.createElement('span');
    staleTag.className = 'tmx-format-wizard-stale-tag';
    staleTag.style.cssText = STALE_TAG_STYLE;
    staleTag.textContent = t('formatWizard.card.staleTag');
    topRow.appendChild(staleTag);
  } else if (options.selected) {
    const considerTag = document.createElement('span');
    considerTag.className = 'tmx-format-wizard-consider-tag';
    considerTag.style.cssText = CONSIDER_TAG_STYLE;
    considerTag.textContent = t('formatWizard.card.considerTag');
    topRow.appendChild(considerTag);
  }

  card.appendChild(topRow);

  const flightLine = document.createElement('div');
  flightLine.style.cssText = FLIGHTS_LINE_STYLE;
  flightLine.textContent = flightSummary(plan);
  card.appendChild(flightLine);

  const numbers = document.createElement('div');
  numbers.style.cssText = NUMBERS_ROW_STYLE;
  numbers.appendChild(
    buildNumberBlock(formatMatchesPerPlayer(plan.aggregate.minMatchesPerPlayer), t('formatWizard.card.matchesPerPlayer')),
  );
  numbers.appendChild(buildNumberBlock(formatPercent(plan.aggregate.competitive), t('formatWizard.card.competitive')));
  numbers.appendChild(buildNumberBlock(formatHours(plan.aggregate.courtHoursRequired), t('formatWizard.card.courtHours')));
  card.appendChild(numbers);

  if (plan.warnings.length > 0) {
    card.appendChild(buildWarningChips(plan.warnings));
  }

  const footerRow = document.createElement('div');
  footerRow.style.cssText = FOOTER_ROW_STYLE;

  if (options.stale && options.onRemoveStale) {
    const trashBtn = document.createElement('button');
    trashBtn.className = TRASH_BUTTON_CLASS;
    trashBtn.style.cssText = TRASH_BUTTON_STYLE;
    trashBtn.innerHTML = '<i class="fa fa-trash"></i>';
    trashBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      options.onRemoveStale!();
    });
    footerRow.appendChild(trashBtn);
  } else if (options.onApply) {
    const applyBtn = document.createElement('button');
    applyBtn.className = APPLY_BUTTON_CLASS;
    applyBtn.dataset.rank = String(plan.rank);
    applyBtn.style.cssText = APPLY_BUTTON_STYLE;
    applyBtn.textContent = t('formatWizard.apply.button');
    applyBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      options.onApply!(plan);
    });
    footerRow.appendChild(applyBtn);
  } else {
    footerRow.appendChild(document.createElement('span'));
  }

  const scoreFooter = document.createElement('span');
  scoreFooter.style.cssText = SCORE_FOOTER_STYLE;
  scoreFooter.textContent = `${t('formatWizard.card.score')} ${formatPercent(plan.score)}`;
  footerRow.appendChild(scoreFooter);

  card.appendChild(footerRow);

  return card;
}

// Builds a minimal "stale" placeholder card from a fingerprint
// alone — used when a pinned plan no longer appears in the
// current results and we don't have a snapshot to render against.
// Carries the trash button so the user can clear it explicitly.
export function buildStalePlaceholderCard({
  fingerprint,
  onRemove,
}: {
  fingerprint: string;
  onRemove: () => void;
}): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'tmx-format-wizard-plan-card';
  card.dataset.stale = 'true';
  card.dataset.fingerprint = fingerprint;
  card.style.cssText = CARD_STYLE_STALE;

  const parts = fingerprint.split(':');
  // Fingerprint shape: <strategy>:<variant>:<kind>:<variantId>:<vc>:<sizes>
  const [, , kind, variantId, vc, sizes] = parts;

  const topRow = document.createElement('div');
  topRow.style.cssText = TOP_ROW_STYLE;

  const archetype = document.createElement('span');
  archetype.className = 'tmx-format-wizard-plan-archetype';
  archetype.style.cssText = ARCHETYPE_STYLE;
  archetype.textContent = (kind ?? 'PLAN').replace(/_/g, ' ');
  topRow.appendChild(archetype);

  if (variantId) {
    const variant = document.createElement('span');
    variant.style.cssText = VARIANT_STYLE;
    variant.textContent = variantId;
    topRow.appendChild(variant);
  }
  if (vc === 'vc') {
    const vcTag = document.createElement('span');
    vcTag.style.cssText = VC_TAG_STYLE;
    vcTag.textContent = t('formatWizard.card.vcTag');
    topRow.appendChild(vcTag);
  }

  const staleTag = document.createElement('span');
  staleTag.style.cssText = STALE_TAG_STYLE;
  staleTag.textContent = t('formatWizard.card.staleTag');
  topRow.appendChild(staleTag);

  card.appendChild(topRow);

  if (sizes) {
    const flightLine = document.createElement('div');
    flightLine.style.cssText = FLIGHTS_LINE_STYLE;
    flightLine.textContent = sizes.split(',').join(' / ');
    card.appendChild(flightLine);
  }

  const footerRow = document.createElement('div');
  footerRow.style.cssText = FOOTER_ROW_STYLE;
  const trashBtn = document.createElement('button');
  trashBtn.className = TRASH_BUTTON_CLASS;
  trashBtn.style.cssText = TRASH_BUTTON_STYLE;
  trashBtn.innerHTML = '<i class="fa fa-trash"></i>';
  trashBtn.addEventListener('click', onRemove);
  footerRow.appendChild(trashBtn);
  footerRow.appendChild(document.createElement('span'));
  card.appendChild(footerRow);

  return card;
}

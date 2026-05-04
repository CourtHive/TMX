import { t } from 'i18n';

// constants and types
import { PlanWarning, RankedPlan } from 'tods-competition-factory';

const CARD_STYLE =
  'border: 1px solid var(--tmx-border-secondary, #eee); border-radius: 6px; background: var(--tmx-bg-primary, #fff); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;';
const TOP_ROW_STYLE = 'display: flex; align-items: center; gap: 8px;';
const RANK_BADGE_STYLE =
  'min-width: 26px; height: 26px; border-radius: 50%; background: var(--tmx-accent-teal, #00b8a9); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600;';
const ARCHETYPE_STYLE = 'font-size: 14px; font-weight: 600; color: var(--tmx-text-primary, #222); flex: 1;';
const VARIANT_STYLE = 'font-size: 12px; color: var(--tmx-text-secondary, #777);';
const FLIGHTS_LINE_STYLE = 'font-size: 12px; color: var(--tmx-text-secondary, #555);';
const NUMBERS_ROW_STYLE = 'display: flex; gap: 16px; flex-wrap: wrap;';
const NUMBER_BLOCK_STYLE = 'display: flex; flex-direction: column; min-width: 96px;';
const NUMBER_VALUE_STYLE = 'font-size: 18px; font-weight: 600; color: var(--tmx-text-primary, #222); line-height: 1.1;';
const NUMBER_LABEL_STYLE =
  'font-size: 11px; color: var(--tmx-text-secondary, #777); text-transform: uppercase; letter-spacing: 0.04em;';
const WARNINGS_ROW_STYLE = 'display: flex; flex-wrap: wrap; gap: 6px;';
const WARNING_CHIP_STYLE_BASE =
  'font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 500; background: var(--tmx-warning-bg, #fff3cd); color: var(--tmx-warning-text, #856404);';
const SCORE_FOOTER_STYLE =
  'font-size: 11px; color: var(--tmx-text-muted, #999); display: flex; justify-content: flex-end;';

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '–';
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${hours.toFixed(1)}h`;
}

function formatFloor(structuralMin: number, effectiveMin: number): string {
  const round1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (Math.abs(structuralMin - effectiveMin) < 0.01) return round1(structuralMin);
  return `${round1(effectiveMin)} / ${round1(structuralMin)}`;
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

// Renders a single ranked plan as a card. Layout follows the
// prior-art UX synthesis: archetype banner + flighting summary + three
// big numbers + warning chips + de-emphasized score footer.
export function buildPlanCard(plan: RankedPlan): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'tmx-format-wizard-plan-card';
  card.dataset.rank = String(plan.rank);
  card.style.cssText = CARD_STYLE;

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

  card.appendChild(topRow);

  const flightLine = document.createElement('div');
  flightLine.style.cssText = FLIGHTS_LINE_STYLE;
  flightLine.textContent = flightSummary(plan);
  card.appendChild(flightLine);

  const numbers = document.createElement('div');
  numbers.style.cssText = NUMBERS_ROW_STYLE;
  numbers.appendChild(
    buildNumberBlock(
      formatFloor(plan.aggregate.minMatchesPerPlayer, plan.aggregate.effectiveMinMatchesPerPlayer),
      t('formatWizard.card.matchesPerPlayer'),
    ),
  );
  numbers.appendChild(buildNumberBlock(formatPercent(plan.aggregate.competitive), t('formatWizard.card.competitive')));
  numbers.appendChild(buildNumberBlock(formatHours(plan.aggregate.courtHoursRequired), t('formatWizard.card.courtHours')));
  card.appendChild(numbers);

  if (plan.warnings.length > 0) {
    card.appendChild(buildWarningChips(plan.warnings));
  }

  const scoreFooter = document.createElement('div');
  scoreFooter.style.cssText = SCORE_FOOTER_STYLE;
  scoreFooter.textContent = `${t('formatWizard.card.score')} ${formatPercent(plan.score)}`;
  card.appendChild(scoreFooter);

  return card;
}

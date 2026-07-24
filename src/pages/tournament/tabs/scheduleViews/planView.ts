/**
 * Plan mode chrome — the alternate ("contingency") schedule workspace.
 *
 * Renders the interactive grid via `renderGridView({ planContext })` (which
 * overlays the scenario without mutating engine state) plus a title-slot control
 * strip: scenario switcher, New / Delete, a drift indicator + Rebase, and
 * "Make official" (commits the plan via applyScheduleScenario). All scenario
 * reads/writes go through the scheduleScenarios service.
 */
import {
  rebaseScheduleScenario,
  removeScheduleScenario,
  updateScheduleScenario,
  listScheduleScenarios,
  applyScheduleScenario,
  addScheduleScenario,
  getScenarioStatus,
} from 'services/scheduleScenarios/scheduleScenariosService';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { renderGridView, destroyGridView } from './gridView';
import { context } from 'services/context';
import { t } from 'i18n';

import { SCHEDULING_TAB, TOURNAMENT } from 'constants/tmxConstants';

// Selected scenario persists across re-renders within a tab session.
let activePlanScenarioId: string | null = null;

function styledButton(label: string, kind: 'default' | 'accent' | 'danger' = 'default'): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  const bg =
    kind === 'accent'
      ? 'var(--tmx-accent-blue,#2563eb)'
      : kind === 'danger'
        ? 'var(--tmx-status-danger,#dc2626)'
        : 'var(--tmx-bg-secondary,#f3f4f6)';
  const color = kind === 'default' ? 'var(--tmx-text-primary,#111)' : '#fff';
  btn.style.cssText = `padding:4px 10px;border-radius:6px;border:1px solid var(--tmx-border-primary,#d1d5db);background:${bg};color:${color};font-size:0.75rem;cursor:pointer;`;
  return btn;
}

function renderEmptyState(container: HTMLElement, tournamentId: string, rerender: () => void): void {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:2rem;text-align:center;color:var(--tmx-text-muted,#6b7280);';
  const msg = document.createElement('div');
  msg.textContent = t('schedule.plan.empty');
  msg.style.marginBottom = '1rem';
  const create = styledButton(t('schedule.plan.create'), 'accent');
  create.addEventListener('click', () => void createPlan(tournamentId, rerender));
  wrap.append(msg, create);
  container.appendChild(wrap);
}

async function createPlan(tournamentId: string, rerender: () => void): Promise<void> {
  const count = listScheduleScenarios(tournamentId).length;
  const scenarioName = t('schedule.plan.defaultName', { n: count + 1 });
  const result = await addScheduleScenario(tournamentId, { scenarioName, placements: [] });
  if (result?.error) {
    tmxToast({ message: t('schedule.plan.createFailed'), intent: 'is-danger' });
    return;
  }
  activePlanScenarioId = result?.scenarioId ?? result?.scenario?.scenarioId ?? null;
  rerender();
}

function buildPlanChrome(args: {
  tournamentId: string;
  scenarioId: string;
  scenarios: any[];
  scheduledDate: string;
  rerender: () => void;
}): HTMLElement {
  const { tournamentId, scenarioId, scenarios, scheduledDate, rerender } = args;
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

  const badge = document.createElement('span');
  badge.textContent = t('schedule.plan.badge');
  badge.style.cssText =
    'font-size:0.6875rem;font-weight:700;letter-spacing:0.04em;padding:3px 8px;border-radius:6px;' +
    'background:var(--tmx-status-warning,#f59e0b);color:#1a1a1a;';

  const select = document.createElement('select');
  select.style.cssText =
    'padding:4px 8px;border-radius:6px;border:1px solid var(--tmx-border-primary,#d1d5db);background:var(--tmx-bg-primary,#fff);color:var(--tmx-text-primary,#111);font-size:0.75rem;';
  for (const s of scenarios) {
    const opt = document.createElement('option');
    opt.value = s.scenarioId;
    opt.textContent = s.scenarioName ?? s.scenarioId;
    if (s.scenarioId === scenarioId) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => {
    activePlanScenarioId = select.value;
    rerender();
  });

  const active = scenarios.find((s: any) => s.scenarioId === scenarioId);
  const activeName = active?.scenarioName ?? '';
  const placements: any[] = active?.placements ?? [];

  // Render-time status drives both the summary chip and the drift indicator
  // (one read instead of two).
  const renderStatus: any = getScenarioStatus(tournamentId, scenarioId);
  const completedSet = new Set<string>(renderStatus?.completedMatchUpIds ?? []);
  let planned = 0;
  let unscheduled = 0;
  for (const p of placements) {
    if (completedSet.has(p.matchUpId)) continue;
    if (p.schedule?.scheduledDate) planned++;
    else unscheduled++;
  }
  const summary = document.createElement('span');
  summary.textContent = t('schedule.plan.summary', { planned, unscheduled, skipped: completedSet.size });
  summary.style.cssText = 'font-size:0.75rem;color:var(--tmx-text-muted,#6b7280);white-space:nowrap;';

  const renameBtn = styledButton(t('schedule.plan.rename'));
  renameBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.value = activeName;
    input.setAttribute('aria-label', t('schedule.plan.nameLabel'));
    input.style.cssText =
      'padding:4px 8px;border-radius:6px;border:1px solid var(--tmx-accent-blue,#2563eb);background:var(--tmx-bg-primary,#fff);color:var(--tmx-text-primary,#111);font-size:0.75rem;';
    select.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      if (name && name !== activeName) await updateScheduleScenario(tournamentId, scenarioId, { scenarioName: name });
      rerender();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void commit();
      else if (e.key === 'Escape') {
        done = true;
        rerender();
      }
    });
    input.addEventListener('blur', () => void commit());
  });

  const newBtn = styledButton(t('schedule.plan.new'));
  newBtn.addEventListener('click', () => void createPlan(tournamentId, rerender));

  const duplicateBtn = styledButton(t('schedule.plan.duplicate'));
  duplicateBtn.addEventListener('click', async () => {
    const result: any = await addScheduleScenario(tournamentId, {
      scenarioName: t('schedule.plan.copyName', { name: activeName }),
      placements: placements.map((p) => ({ ...p, schedule: { ...p.schedule } })),
    });
    if (result?.error) {
      tmxToast({ message: t('schedule.plan.createFailed'), intent: 'is-danger' });
      return;
    }
    activePlanScenarioId = result?.scenarioId ?? result?.scenario?.scenarioId ?? null;
    rerender();
  });

  const deleteBtn = styledButton(t('schedule.plan.delete'), 'danger');
  deleteBtn.addEventListener('click', () => {
    confirmModal({
      title: t('schedule.plan.deleteTitle'),
      query: t('schedule.plan.deleteQuery'),
      okIntent: 'is-danger',
      okAction: async () => {
        await removeScheduleScenario(tournamentId, scenarioId);
        activePlanScenarioId = null;
        rerender();
      },
    });
  });

  const makeOfficial = styledButton(t('schedule.plan.makeOfficial'), 'accent');
  makeOfficial.addEventListener('click', () => {
    const status: any = getScenarioStatus(tournamentId, scenarioId);
    const skipped = status?.completedMatchUpIds?.length ?? 0;
    const skipNote = skipped ? t('schedule.plan.commitSkip', { count: skipped }) : '';
    const driftNote = status?.outOfDate ? t('schedule.plan.commitDrift') : '';
    confirmModal({
      title: t('schedule.plan.commitTitle'),
      query: `${t('schedule.plan.commitQuery')}${skipNote}${driftNote}`,
      okIntent: 'is-warning',
      okAction: async () => {
        const result: any = await applyScheduleScenario(tournamentId, scenarioId);
        if (result?.error) {
          tmxToast({ message: t('schedule.plan.applyFailed'), intent: 'is-danger' });
          return;
        }
        tmxToast({ message: t('schedule.plan.applied', { count: result?.applied ?? 0 }), intent: 'is-success' });
        context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/${SCHEDULING_TAB}/${scheduledDate}/grid`);
      },
    });
  });

  bar.append(badge, summary, select, renameBtn, duplicateBtn, newBtn, deleteBtn);

  // Drift indicator + rebase (reuses the render-time status computed above).
  if (renderStatus?.outOfDate) {
    const warn = document.createElement('span');
    warn.textContent = t('schedule.plan.outOfDate');
    warn.title = t('schedule.plan.outOfDateTip');
    warn.style.cssText = 'font-size:0.75rem;color:var(--tmx-status-warning,#b45309);font-weight:600;';
    const rebase = styledButton(t('schedule.plan.rebase'));
    rebase.addEventListener('click', async () => {
      await rebaseScheduleScenario(tournamentId, scenarioId);
      rerender();
    });
    bar.append(warn, rebase);
  }

  bar.appendChild(makeOfficial);
  return bar;
}

export function renderPlanMode(container: HTMLElement, scheduledDate: string, tournamentId: string): void {
  const rerender = () => renderPlanMode(container, scheduledDate, tournamentId);

  // Re-render fully rebuilds: tear down the previous grid (subscriptions, active
  // strip) and clear the container so switcher/banner/grid never stack. Mirrors
  // the tab's destroy-then-render cycle; idempotent on first mount.
  destroyGridView();
  container.innerHTML = '';

  const scenarios = listScheduleScenarios(tournamentId);
  if (!scenarios.find((s: any) => s.scenarioId === activePlanScenarioId)) {
    activePlanScenarioId = scenarios[0]?.scenarioId ?? null;
  }

  if (!activePlanScenarioId) {
    renderEmptyState(container, tournamentId, rerender);
    return;
  }

  const chrome = buildPlanChrome({
    tournamentId,
    scenarioId: activePlanScenarioId,
    scenarios,
    scheduledDate,
    rerender,
  });

  renderGridView(container, scheduledDate, {
    planContext: { scenarioId: activePlanScenarioId, tournamentId },
    titleSlot: chrome,
    activeStripVisible: false,
  });

  // Plan data is derived, not the live table — don't let remote-refresh repaint it as official.
  context.refreshActiveTable = rerender;
}

/**
 * Make the catalog inert (visible but non-interactive, "reference only") — the
 * catalog's `buildCatalog` is plan-aware, so the default Plan mode leaves it
 * interactive (drag both ways). Retained as reusable tooling for future
 * plan-adjacent UI where a read-only catalog is wanted; targets the catalog
 * panel via its stable title-row child (title-row → header → panel root).
 */
export function markCatalogInert(container: HTMLElement): void {
  const titleRow = container.querySelector('.spl-catalog-title-row');
  const panel = titleRow?.parentElement?.parentElement as HTMLElement | null;
  if (panel) panel.classList.add('tmx-plan-catalog-inert');
}

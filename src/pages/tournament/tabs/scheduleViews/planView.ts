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
  msg.textContent = 'No alternate plans yet. Create one to stage a contingency schedule off the live grid.';
  msg.style.marginBottom = '1rem';
  const create = styledButton('Create plan', 'accent');
  create.addEventListener('click', () => void createPlan(tournamentId, rerender));
  wrap.append(msg, create);
  container.appendChild(wrap);
}

async function createPlan(tournamentId: string, rerender: () => void): Promise<void> {
  const count = listScheduleScenarios(tournamentId).length;
  const scenarioName = `Plan ${count + 1}`;
  const result = await addScheduleScenario(tournamentId, { scenarioName, placements: [] });
  if (result?.error) {
    tmxToast({ message: 'Could not create plan', intent: 'is-danger' });
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
  badge.textContent = 'PLANNING — not live';
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

  const activeName = scenarios.find((s: any) => s.scenarioId === scenarioId)?.scenarioName ?? '';
  const renameBtn = styledButton('Rename');
  renameBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.value = activeName;
    input.setAttribute('aria-label', 'Plan name');
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

  const newBtn = styledButton('New');
  newBtn.addEventListener('click', () => void createPlan(tournamentId, rerender));

  const deleteBtn = styledButton('Delete', 'danger');
  deleteBtn.addEventListener('click', () => {
    confirmModal({
      title: 'Delete plan?',
      query: 'This removes the alternate plan. The official schedule is unaffected.',
      okIntent: 'is-danger',
      okAction: async () => {
        await removeScheduleScenario(tournamentId, scenarioId);
        activePlanScenarioId = null;
        rerender();
      },
    });
  });

  const makeOfficial = styledButton('Make official', 'accent');
  makeOfficial.addEventListener('click', () => {
    const status: any = getScenarioStatus(tournamentId, scenarioId);
    const skipped = status?.completedMatchUpIds?.length ?? 0;
    const drift = status?.outOfDate ? ' This plan is out of date.' : '';
    confirmModal({
      title: 'Make this the official schedule?',
      query: `Commits the plan to the live schedule (uncompleted matchUps only).${
        skipped ? ` ${skipped} completed match(es) will be skipped.` : ''
      }${drift}`,
      okIntent: 'is-warning',
      okAction: async () => {
        const result: any = await applyScheduleScenario(tournamentId, scenarioId);
        if (result?.error) {
          tmxToast({ message: 'Could not apply plan', intent: 'is-danger' });
          return;
        }
        tmxToast({ message: `Plan applied — ${result?.applied ?? 0} matches scheduled`, intent: 'is-success' });
        context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/${SCHEDULING_TAB}/${scheduledDate}/grid`);
      },
    });
  });

  bar.append(badge, select, renameBtn, newBtn, deleteBtn);

  // Drift indicator + rebase
  const status: any = getScenarioStatus(tournamentId, scenarioId);
  if (status?.outOfDate) {
    const warn = document.createElement('span');
    warn.textContent = '⚠ out of date';
    warn.title = 'The official schedule changed since this plan was authored.';
    warn.style.cssText = 'font-size:0.75rem;color:var(--tmx-status-warning,#b45309);font-weight:600;';
    const rebase = styledButton('Rebase');
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

  markCatalogInert(container);

  // Plan data is derived, not the live table — don't let remote-refresh repaint it as official.
  context.refreshActiveTable = rerender;
}

// The catalog is shown for reference in Plan mode but must not be an actionable
// pool: a plan never removes matchUps from the catalog until it is made official.
// Disable interaction (pointer-events) + mark it visually. Targets the catalog
// panel via its stable title-row child (title-row → header → panel root).
function markCatalogInert(container: HTMLElement): void {
  const titleRow = container.querySelector('.spl-catalog-title-row');
  const panel = titleRow?.parentElement?.parentElement as HTMLElement | null;
  if (panel) panel.classList.add('tmx-plan-catalog-inert');
}

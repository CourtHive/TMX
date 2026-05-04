/**
 * Format Wizard Page — standalone tournament-context page for the
 * level-based format wizard. Routed at
 * `/tournament/:tournamentId/format-wizard`. Launched from the
 * tournament overview (no navbar icon) and intentionally NOT
 * admin-gated — works in demo mode against the local-only
 * mutation path.
 */
import { buildConstraintsForm, ConstraintsFormHandle, ConstraintsFormState } from 'components/modals/formatWizard/constraintsForm';
import { buildRightPane, RightPaneHandle } from 'components/modals/formatWizard/rightPane';
import {
  applyFormatPlan,
  buildApplyMethods,
  getTournamentCapacity,
  readWizardState,
  runFormatWizard,
  writeWizardState,
} from 'services/formatWizard';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { removeAllChildNodes } from 'services/dom/transformers';
import { showFormatWizard } from 'services/transitions/screenSlaver';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { context } from 'services/context';
import { t } from 'i18n';

// constants and types
import {
  FORMAT_WIZARD_BACK,
  FORMAT_WIZARD_CONTENT,
  FORMAT_WIZARD_PAGE,
  TMX_FORMAT_WIZARD,
  TOURNAMENT,
} from 'constants/tmxConstants';
import { RankedPlan } from 'tods-competition-factory';

const PERSIST_DEBOUNCE_MS = 500;

const PAGE_HEADER_STYLE =
  'display: flex; align-items: center; gap: 12px; padding: 16px 24px; border-bottom: 1px solid var(--tmx-border-secondary, #e5e5e5); background: var(--tmx-bg-primary, #fff); position: sticky; top: 0; z-index: 1;';
const PAGE_TITLE_STYLE = 'font-size: 18px; font-weight: 600; color: var(--tmx-text-primary, #222); flex: 1;';
const BACK_BUTTON_STYLE =
  'background: var(--tmx-bg-secondary, #f7f7f9); border: 1px solid var(--tmx-border-primary, #ddd); border-radius: 4px; padding: 6px 14px; cursor: pointer; font-size: 14px; color: var(--tmx-text-primary, #222);';
const PAGE_BODY_STYLE = 'display: flex; flex: 1; min-height: 0; overflow: hidden;';
const PAGE_ROOT_STYLE = 'flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden;';

let activeFormHandle: ConstraintsFormHandle | undefined;

function navigateToOverview(): void {
  const tournamentId = tournamentEngine.getTournament?.()?.tournamentRecord?.tournamentId;
  if (!tournamentId) return;
  context.router?.navigate(`/${TOURNAMENT}/${tournamentId}`);
}

function recompute(formState: ConstraintsFormState, rightPane: RightPaneHandle): void {
  const result = runFormatWizard({
    constraints: formState.constraints,
    scaleName: formState.scaleName,
  });
  if (result.error === 'INSUFFICIENT_RATED_PARTICIPANTS' && result.totalParticipants === 0) {
    rightPane.setEmpty(t('formatWizard.summary.loadTournament'));
    return;
  }
  rightPane.setData(result);
}

function handleApply(plan: RankedPlan, scaleName: string): void {
  const preview = buildApplyMethods({ plan, scaleName });
  if (preview.eventCount === 0) {
    tmxToast({ message: t('formatWizard.apply.errorEmpty'), intent: 'is-warning' });
    return;
  }

  const lines: string[] = [
    t('formatWizard.apply.confirmBody', {
      eventCount: preview.eventCount,
      participantCount: preview.participantCount,
    }),
  ];
  if (preview.unsupported.length > 0) {
    lines.push(t('formatWizard.apply.confirmBodyUnsupported', { unsupportedCount: preview.unsupported.length }));
  }

  confirmModal({
    title: t('formatWizard.apply.confirmTitle'),
    query: lines.join(' '),
    okIntent: 'is-primary',
    cancelAction: () => undefined,
    okAction: () =>
      applyFormatPlan({
        plan,
        scaleName,
        callback: (result) => {
          if (result.success) {
            tmxToast({
              message: t('formatWizard.apply.success', { eventCount: result.eventIds.length }),
              intent: 'is-success',
            });
            navigateToOverview();
            return;
          }
          tmxToast({ message: t('formatWizard.apply.errorEvents'), intent: 'is-danger' });
        },
      }),
  });
}

function buildPageBody(formHandle: ConstraintsFormHandle, rightPane: RightPaneHandle): HTMLElement {
  const body = document.createElement('div');
  body.id = FORMAT_WIZARD_CONTENT;
  body.className = 'tmx-format-wizard-content';
  body.style.cssText = PAGE_BODY_STYLE;
  body.appendChild(formHandle.element);
  body.appendChild(rightPane.element);
  return body;
}

function buildPageHeader(): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText = PAGE_HEADER_STYLE;

  const back = document.createElement('button');
  back.id = FORMAT_WIZARD_BACK;
  back.type = 'button';
  back.style.cssText = BACK_BUTTON_STYLE;
  back.innerHTML = `<i class="fa fa-chevron-left"></i> ${t('back')}`;
  back.addEventListener('click', () => navigateToOverview());
  header.appendChild(back);

  const title = document.createElement('div');
  title.style.cssText = PAGE_TITLE_STYLE;
  title.textContent = t('formatWizard.title');
  header.appendChild(title);

  return header;
}

export function destroyFormatWizardPage(): void {
  if (activeFormHandle) {
    activeFormHandle.setOnChange(() => undefined);
    activeFormHandle = undefined;
  }
}

export function renderFormatWizardPage(): void {
  const container = document.getElementById(TMX_FORMAT_WIZARD);
  if (!container) return;

  destroyFormatWizardPage();
  removeAllChildNodes(container);
  showFormatWizard();

  const persisted = readWizardState();
  const formHandle = buildConstraintsForm({
    initialScaleName: persisted?.scaleName,
    initialConstraints: persisted?.constraints,
  });
  const rightPane = buildRightPane();
  activeFormHandle = formHandle;

  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  const schedulePersist = (state: ConstraintsFormState): void => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      writeWizardState({ scaleName: state.scaleName, constraints: state.constraints });
      persistTimer = undefined;
    }, PERSIST_DEBOUNCE_MS);
  };

  rightPane.setOnApply((plan) => handleApply(plan, formHandle.getState().scaleName));
  formHandle.setCapacity(getTournamentCapacity());
  formHandle.setOnChange((state) => {
    recompute(state, rightPane);
    schedulePersist(state);
  });

  const root = document.createElement('div');
  root.id = FORMAT_WIZARD_PAGE;
  root.style.cssText = PAGE_ROOT_STYLE;
  root.appendChild(buildPageHeader());
  root.appendChild(buildPageBody(formHandle, rightPane));
  container.appendChild(root);

  // Initial render so the user sees plans (or empty-state hint)
  // before they touch the form.
  recompute(formHandle.getState(), rightPane);
}

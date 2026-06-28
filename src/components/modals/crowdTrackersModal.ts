/**
 * Crowd trackers modal — Phase 4 TD promotion UI.
 *
 * Opens from the matchUp three-dot menu's "View crowd trackers (N)" action.
 * Lists every active crowd-scoring session for the matchUp with promote /
 * demote / cancel buttons. Calls the slice-3 REST endpoints on score-relay
 * (Decision 6: crowd data never crosses competition-factory-server).
 *
 * The list refreshes after every action so the trusted/cancelled state stays
 * consistent. Errors surface via the scoreRelayApi toast interceptor; the
 * modal stays open so the TD can retry.
 */

import { openModal } from 'components/modals/baseModal/baseModal';
import {
  cancelSession as apiCancelSession,
  demoteSession as apiDemoteSession,
  getSessionsByMatchUpId,
  promoteSession as apiPromoteSession,
  type CrowdScoringSession,
} from 'services/crowd/scoreRelayClient';
import {
  buildSecondaryLine,
  buildStatusMessage,
  decidePrimaryButtonLabel,
} from 'components/modals/crowdTrackersModalLogic';

interface CrowdTrackersModalOptions {
  matchUpId: string;
  matchUpLabel?: string;
  /** Test hook — defaults to the live REST client. */
  loader?: (matchUpId: string) => Promise<CrowdScoringSession[]>;
  /** Test hooks — default to the live REST client. */
  actions?: {
    promote?: (sessionId: string) => Promise<unknown>;
    demote?: (sessionId: string) => Promise<unknown>;
    cancel?: (sessionId: string) => Promise<unknown>;
  };
}

const ROW_STYLE =
  'display:flex; align-items:center; gap:8px; padding:6px 8px; border-bottom:1px solid var(--tmx-border-primary, #eee); font-size:0.9rem;';
const ROW_META_STYLE = 'flex:1; display:flex; flex-direction:column; gap:2px;';
const ROW_PRIMARY_STYLE = 'font-weight:600;';
const ROW_SECONDARY_STYLE = 'font-size:0.75rem; color:var(--tmx-text-secondary, #666);';
const ROW_ACTIONS_STYLE = 'display:flex; gap:4px;';
const BTN_STYLE =
  'padding:3px 8px; border:1px solid var(--tmx-border-primary, #ddd); border-radius:4px; background:var(--tmx-bg-primary, #fff); color:var(--tmx-text-primary, #1a1a1a); cursor:pointer; font-size:0.8rem;';

export function openCrowdTrackersModal(opts: CrowdTrackersModalOptions): void {
  const loader = opts.loader ?? ((matchUpId: string) => getSessionsByMatchUpId({ matchUpId, activeOnly: true }));
  const promote = opts.actions?.promote ?? apiPromoteSession;
  const demote = opts.actions?.demote ?? apiDemoteSession;
  const cancel = opts.actions?.cancel ?? apiCancelSession;

  const content = (root: HTMLElement) => {
    root.innerHTML = '';

    const status = document.createElement('div');
    status.style.cssText = 'padding:6px 0; font-size:0.85rem; color:var(--tmx-text-secondary, #666);';
    status.textContent = 'Loading…';
    root.appendChild(status);

    const list = document.createElement('div');
    list.dataset.testid = 'crowd-trackers-list';
    root.appendChild(list);

    const refresh = async () => {
      let sessions: CrowdScoringSession[];
      try {
        sessions = await loader(opts.matchUpId);
      } catch {
        // toast handled by axios interceptor
        return;
      }
      renderList(list, status, sessions, { promote, demote, cancel, refresh });
    };

    void refresh();
  };

  const title = opts.matchUpLabel ? `Crowd trackers — ${opts.matchUpLabel}` : 'Crowd trackers';
  const buttons = [{ label: 'Close', close: true, intent: 'is-light' }];
  openModal({ title, content, buttons });
}

interface RowActions {
  promote: (sessionId: string) => Promise<unknown>;
  demote: (sessionId: string) => Promise<unknown>;
  cancel: (sessionId: string) => Promise<unknown>;
  refresh: () => Promise<void>;
}

export function renderList(
  list: HTMLElement,
  status: HTMLElement,
  sessions: CrowdScoringSession[],
  actions: RowActions,
): void {
  list.innerHTML = '';
  status.textContent = buildStatusMessage(sessions.length);
  if (sessions.length === 0) return;
  for (const session of sessions) list.appendChild(renderRow(session, actions));
}

function renderRow(session: CrowdScoringSession, actions: RowActions): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = ROW_STYLE;
  row.dataset.sessionId = session.sessionId;

  const meta = document.createElement('div');
  meta.style.cssText = ROW_META_STYLE;

  const primary = document.createElement('div');
  primary.style.cssText = ROW_PRIMARY_STYLE;
  primary.textContent = session.userId;
  if (session.trusted) {
    const badge = document.createElement('span');
    badge.style.cssText =
      'margin-left:6px; padding:1px 5px; border-radius:3px; background:var(--tmx-status-success, #2bb673); color:#fff; font-size:0.7rem;';
    badge.textContent = 'TRUSTED';
    primary.appendChild(badge);
  }
  meta.appendChild(primary);

  const secondary = document.createElement('div');
  secondary.style.cssText = ROW_SECONDARY_STYLE;
  secondary.textContent = buildSecondaryLine(session);
  meta.appendChild(secondary);

  row.appendChild(meta);

  const buttons = document.createElement('div');
  buttons.style.cssText = ROW_ACTIONS_STYLE;

  const primaryLabel = decidePrimaryButtonLabel(session);
  const primaryAction = primaryLabel === 'Demote' ? actions.demote : actions.promote;
  buttons.appendChild(
    makeButton(primaryLabel, async () => {
      await primaryAction(session.sessionId).catch(() => undefined);
      await actions.refresh();
    }),
  );

  buttons.appendChild(
    makeButton('Cancel', async () => {
      await actions.cancel(session.sessionId).catch(() => undefined);
      await actions.refresh();
    }),
  );

  row.appendChild(buttons);
  return row;
}

function makeButton(label: string, onClick: () => void | Promise<void>): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText = BTN_STYLE;
  btn.textContent = label;
  btn.addEventListener('click', () => void onClick());
  return btn;
}


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
  resolveSessionScorer,
  scorerBadgeLabel,
} from 'components/modals/crowdTrackersModalLogic';
import { acceptTrustedSession } from 'services/crowd/delegatedOutcomeFlow';
import { isTrustedScorer } from 'services/crowd/classifyScorer';
import { tournamentEngine } from 'tods-competition-factory';
import { t } from 'i18n';

/** matchUp context threaded to the rows so per-matchUp nomination + Accept work. */
interface RowContext {
  matchUpId: string;
  drawId?: string;
  matchUp?: any;
}

interface CrowdTrackersModalOptions {
  matchUpId: string;
  matchUpLabel?: string;
  /** Test hook — defaults to the live REST client. */
  loader?: (matchUpId: string) => Promise<CrowdScoringSession[]>;
  /** Test hook — defaults to the loaded tournament's participants. */
  participantsLoader?: () => any[];
  /** Test hooks — default to the live REST client. */
  actions?: {
    promote?: (sessionId: string) => Promise<unknown>;
    demote?: (sessionId: string) => Promise<unknown>;
    cancel?: (sessionId: string) => Promise<unknown>;
  };
}

function loadTournamentParticipants(): any[] {
  return tournamentEngine.getParticipants?.({ withIndividualParticipants: true })?.participants ?? [];
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
  const participantsLoader = opts.participantsLoader ?? loadTournamentParticipants;
  const promote = opts.actions?.promote ?? apiPromoteSession;
  const demote = opts.actions?.demote ?? apiDemoteSession;
  const cancel = opts.actions?.cancel ?? apiCancelSession;

  const content = (root: HTMLElement) => {
    root.innerHTML = '';

    const status = document.createElement('div');
    status.style.cssText = 'padding:6px 0; font-size:0.85rem; color:var(--tmx-text-secondary, #666);';
    status.textContent = t('crowd.loading');
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
      const participants = participantsLoader();
      const matchUp = (tournamentEngine as any).q?.matchUp?.({ matchUpId: opts.matchUpId });
      const ctx: RowContext = { matchUpId: opts.matchUpId, drawId: matchUp?.drawId, matchUp };
      renderList(list, status, sessions, participants, { promote, demote, cancel, refresh }, ctx);
    };

    void refresh();
  };

  const title = opts.matchUpLabel ? t('crowd.trackersFor', { label: opts.matchUpLabel }) : t('crowd.trackers');
  const buttons = [{ label: t('crowd.close'), close: true, intent: 'is-light' }];
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
  participants: any[],
  actions: RowActions,
  ctx?: RowContext,
): void {
  list.innerHTML = '';
  status.textContent = buildStatusMessage(sessions.length);
  if (sessions.length === 0) return;
  for (const session of sessions) list.appendChild(renderRow(session, participants, actions, ctx));
}

function makeBadge(text: string, bg: string): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.style.cssText = `margin-left:6px; padding:1px 5px; border-radius:3px; background:${bg}; color:#fff; font-size:0.7rem;`;
  badge.textContent = text;
  return badge;
}

const SUCCESS_GREEN = 'var(--tmx-status-success, #2bb673)';

const CLASSIFICATION_BG: Record<string, string> = {
  official: 'var(--tmx-accent-blue, #2d6cdf)',
  scorekeeper: SUCCESS_GREEN,
  participant: 'var(--tmx-accent-blue, #2d6cdf)',
  crowd: 'var(--tmx-text-secondary, #666)',
  anonymous: 'var(--tmx-text-secondary, #999)',
};

function renderRow(session: CrowdScoringSession, participants: any[], actions: RowActions, ctx?: RowContext): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = ROW_STYLE;
  row.dataset.sessionId = session.sessionId;

  const scorer = resolveSessionScorer(session, participants, ctx?.matchUp);

  const meta = document.createElement('div');
  meta.style.cssText = ROW_META_STYLE;

  const primary = document.createElement('div');
  primary.style.cssText = ROW_PRIMARY_STYLE;
  primary.textContent = scorer.participantName || session.crowdScoredBy?.displayName || session.userId;
  primary.appendChild(makeBadge(scorerBadgeLabel(scorer.classification), CLASSIFICATION_BG[scorer.classification]));
  if (scorer.verified) primary.appendChild(makeBadge(t('crowd.badge.verified'), SUCCESS_GREEN));
  if (session.trusted) primary.appendChild(makeBadge(t('crowd.badge.nominated'), SUCCESS_GREEN));
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
  // "Promote" is the nominate action — gate it on nomination eligibility.
  // "Demote" (un-nominate) is always allowed so a TD can reverse a mistake.
  const nominateBlocked = primaryLabel === 'Promote' && !scorer.nominatable;
  buttons.appendChild(
    makeButton(
      t(primaryLabel === 'Demote' ? 'crowd.demote' : 'crowd.promote'),
      async () => {
        await primaryAction(session.sessionId).catch(() => undefined);
        await actions.refresh();
      },
      { disabled: nominateBlocked, title: nominateBlocked ? scorer.reason : undefined },
    ),
  );

  // One-click Accept — only for a trusted (nominated/role scorekeeper or
  // official) AND email-verified session (Phase D). Promotes to the authoritative
  // live feed and, once the match is complete, applies the official outcome.
  if (ctx?.matchUpId && ctx?.drawId && isTrustedScorer(scorer.classification) && scorer.verified) {
    const { matchUpId, drawId } = ctx;
    buttons.appendChild(
      makeButton(t('crowd.accept'), async () => {
        await acceptTrustedSession({ session, matchUpId, drawId });
        await actions.refresh();
      }),
    );
  }

  buttons.appendChild(
    makeButton(t('crowd.cancel'), async () => {
      await actions.cancel(session.sessionId).catch(() => undefined);
      await actions.refresh();
    }),
  );

  row.appendChild(buttons);
  return row;
}

function makeButton(
  label: string,
  onClick: () => void | Promise<void>,
  opts: { disabled?: boolean; title?: string } = {},
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText = BTN_STYLE;
  btn.textContent = label;
  if (opts.title) btn.title = opts.title;
  if (opts.disabled) {
    btn.disabled = true;
    btn.style.opacity = '0.4';
    btn.style.cursor = 'not-allowed';
  } else {
    btn.addEventListener('click', () => void onClick());
  }
  return btn;
}


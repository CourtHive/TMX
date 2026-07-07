/**
 * Admin action: republish this tournament to the public rankings list.
 *
 * Opens a confirmation modal that reports the tournament's completeness (via the
 * factory `getTournamentActionableMatchUps` query) and flags a warning when it is
 * not yet effectivelyComplete — i.e. matches remain to be scored. On confirm it
 * POSTs to the CFS single-tournament republish endpoint. Only offered to admins
 * of the active provider.
 */
import { isActiveProviderAdmin } from 'services/authentication/isProviderAdmin';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { baseApi } from 'services/apis/baseApi';

function buildContent(): HTMLElement {
  const { effectivelyComplete, counts }: any = tournamentEngine.getTournamentActionableMatchUps() ?? {};
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;font-size:0.875rem;';

  const summary = document.createElement('div');
  summary.textContent =
    'Republish this tournament to the public rankings list. Points are recomputed from its decided matches.';
  wrap.appendChild(summary);

  if (!effectivelyComplete) {
    const actionable = counts?.actionable ?? 0;
    const warn = document.createElement('div');
    warn.style.cssText = 'color:var(--tmx-status-warning, #d97706); font-weight:600;';
    warn.textContent = `⚠ Not complete — ${actionable} match${
      actionable === 1 ? '' : 'es'
    } still to score. Publishing now includes only decided matches; republish again once finished.`;
    wrap.appendChild(warn);
  }
  return wrap;
}

async function runRepublish(): Promise<void> {
  const { tournamentRecord }: any = tournamentEngine.getTournament() ?? {};
  const tournamentId = tournamentRecord?.tournamentId;
  if (!tournamentId) return;

  // baseApi surfaces HTTP errors as toasts and resolves to undefined on failure.
  const response: any = await baseApi.post(`/admin/rankings-webhook/republish/${tournamentId}`);
  if (!response) return;

  const body = response.data ?? {};
  if (body?.skipped) {
    tmxToast({ message: 'Rankings pipeline is not configured', intent: 'is-info' });
    return;
  }
  const awardCount = body?.responseBody?.awardCount;
  tmxToast({
    message: awardCount != null ? `Rankings republished (${awardCount} awards)` : 'Rankings republished',
    intent: 'is-success',
  });
}

// The "Republish rankings" option for the matchUps Actions menu, or null when
// the current user is not an admin of the active provider.
export function getRepublishRankingsOption(): any | null {
  if (!isActiveProviderAdmin()) return null;
  return {
    onClick: () =>
      confirmModal({
        title: 'Republish rankings',
        query: buildContent(),
        okIntent: 'is-primary',
        okAction: () => runRepublish(),
      }),
    label: 'Republish rankings',
    intent: 'is-primary',
    close: true,
  };
}

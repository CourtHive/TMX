/**
 * "Actions" menu for the matchUps tab.
 *
 * Currently surfaces `abandonTournamentMatchUps`, which bulk-sets every
 * readyToScore matchUp to ABANDONED. Intended for end-of-tournament cleanup:
 * when a tournament will not be completed, its remaining matchUps should not be
 * left in a readyToScore state. The action is only offered once the tournament
 * is on or past its last date (endDate).
 */
import { ABANDON_TOURNAMENT_MATCHUPS } from 'constants/mutationConstants';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { RIGHT } from 'constants/tmxConstants';
import dayjs from 'dayjs';

// Calendar-day comparison via ISO `YYYY-MM-DD` string compare. Avoids the
// `new Date("YYYY-MM-DD")` UTC-midnight off-by-one that renders the wrong day
// west of UTC; `dayjs().format` yields the local calendar date. True when today
// is on or after the tournament's last date.
function onOrPastLastDate(): boolean {
  const { tournamentRecord } = tournamentEngine.getTournament() ?? {};
  const endDate = tournamentRecord?.endDate;
  if (!endDate) return false;
  return dayjs().format('YYYY-MM-DD') >= String(endDate).slice(0, 10);
}

// Modal body: a one-line explanation plus a checkbox that relaxes the default
// `requireNoScore` guard so matchUps with partial scores can also be abandoned.
function buildAbandonContent(): { element: HTMLElement; getRequireNoScore: () => boolean } {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;font-size:0.875rem;';

  const summary = document.createElement('div');
  summary.textContent =
    'Mark every remaining ready-to-score match as Abandoned. Completed matches and byes are unaffected. Intended for tournaments that will not be completed.';
  wrap.appendChild(summary);

  const label = document.createElement('label');
  label.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  const text = document.createElement('span');
  text.textContent = 'Also abandon matches with partial scores';
  label.appendChild(checkbox);
  label.appendChild(text);
  wrap.appendChild(label);

  return { element: wrap, getRequireNoScore: () => !checkbox.checked };
}

function runAbandon(requireNoScore: boolean, onDone?: () => void): void {
  mutationRequest({
    methods: [{ method: ABANDON_TOURNAMENT_MATCHUPS, params: { requireNoScore } }],
    callback: (result: any) => {
      if (result?.error) return;
      const count = result?.results?.[0]?.abandoned ?? 0;
      tmxToast({
        message: count ? `Abandoned ${count} match${count === 1 ? '' : 'es'}` : 'No matches to abandon',
        intent: count ? 'is-success' : 'is-info',
      });
      onDone?.();
    },
  });
}

function showAbandonModal(onDone?: () => void): void {
  const { element, getRequireNoScore } = buildAbandonContent();
  confirmModal({
    title: 'Abandon remaining matches',
    query: element,
    okIntent: 'is-danger',
    okAction: () => runAbandon(getRequireNoScore(), onDone),
  });
}

// Returns the controlBar dropdown item for `options_right`, or null when the
// tournament is not yet on/past its last date (caller filters nulls out).
export function getActionsItem(replaceTableData: () => void): any | null {
  if (!onOrPastLastDate()) return null;
  return {
    options: [
      {
        onClick: () => showAbandonModal(replaceTableData),
        label: 'Abandon remaining matches',
        intent: 'is-danger',
        close: true,
      },
    ],
    id: 'matchUpsActions',
    location: RIGHT,
    label: 'Actions',
    align: RIGHT,
  };
}

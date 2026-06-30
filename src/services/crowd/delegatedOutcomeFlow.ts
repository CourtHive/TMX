/**
 * delegatedOutcomeFlow — the TD-facing record-entry actions for crowd-sourced
 * scoring (Phase D). Builds on the pure helpers in `delegatedOutcome.ts`.
 *
 * Set:     open the scoring editor pre-filled from the nominated (trusted)
 *          crowd session's latest score; on submit, derive side strings and
 *          write a `delegatedOutcome` onto the matchUp (provenance attached).
 * Confirm: promote the delegated outcome to the official score
 *          (`setMatchUpStatus`) and clear the delegated marker
 *          (`removeDelegatedOutcome`).
 *
 * CFS never sees crowd traffic — the score arrives via the relay; only the TD's
 * explicit Set/Confirm mutations touch the record (the normal mutationRequest
 * path). See Mentat `feedback_cfs_no_crowd_traffic`.
 */

import { buildConfirmMethods, buildDelegatedOutcome, readDelegatedOutcome, snapshotToSets, type DelegatedOutcomeScorer } from 'services/crowd/delegatedOutcome';
import { getSessionsByMatchUpId, type CrowdScoringSession } from 'services/crowd/scoreRelayClient';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { scoringModal } from 'components/modals/scoringV2';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

import { SET_DELEGATED_OUTCOME } from 'constants/mutationConstants';

function trustedSession(sessions: CrowdScoringSession[]): CrowdScoringSession | undefined {
  return sessions.find((s) => s.trusted);
}

function sessionScorer(session: CrowdScoringSession): DelegatedOutcomeScorer {
  return {
    personId: session.crowdScoredBy?.personId ?? null,
    displayName: session.crowdScoredBy?.displayName,
  };
}

/**
 * Open the scoring editor pre-filled from the nominated crowd session and, on
 * submit, write the delegated outcome. Requires a trusted session for the
 * matchUp (the TD nominates first via the crowd-trackers modal).
 */
export async function openSetDelegatedOutcome(args: {
  matchUpId: string;
  drawId: string;
  callback?: (result: any) => void;
}): Promise<void> {
  const { matchUpId, drawId, callback } = args;

  const sessions = await getSessionsByMatchUpId({ matchUpId, activeOnly: true }).catch(() => []);
  const session = trustedSession(sessions);
  if (!session) {
    tmxToast({ intent: 'is-warning', message: t('crowd.toast.nominateFirst') });
    return;
  }

  const matchUp = tournamentEngine.q?.matchUp?.({ matchUpId }) ?? { matchUpId, drawId };
  const prefillSets = snapshotToSets(session.currentScore);
  // Pre-fill the editor with the nominated scorer's latest score (adjustable).
  const prefillMatchUp = {
    ...matchUp,
    sets: prefillSets,
    score: { sets: prefillSets },
  };
  const scorer = sessionScorer(session);

  const onSubmit = (outcome: any) => {
    let sets = outcome?.sets ?? outcome?.score?.sets ?? [];
    if (!sets.length && outcome?.score && typeof outcome.score === 'string') {
      sets = tournamentEngine.parseScoreString({ scoreString: outcome.score }) ?? [];
    }
    // Canonical outcome — the factory derives any per-side strings internally.
    const delegated = buildDelegatedOutcome({
      score: { sets },
      matchUpStatus: outcome?.matchUpStatus,
      winningSide: outcome?.winningSide,
      scorer,
    });
    mutationRequest({
      methods: [{ method: SET_DELEGATED_OUTCOME, params: { matchUpId, drawId, outcome: delegated } }],
      callback: (result: any) => callback?.({ ...result, delegated }),
    });
  };

  scoringModal({ matchUp: prefillMatchUp, callback: onSubmit });
}

/**
 * Promote a matchUp's delegated outcome to the official score and clear the
 * delegated marker. No-op (with a toast) when there is no delegated outcome.
 */
export function confirmDelegatedOutcome(args: {
  matchUpId: string;
  drawId: string;
  matchUp?: any;
  callback?: (result: any) => void;
}): void {
  const { matchUpId, drawId, matchUp, callback } = args;
  const delegatedOutcome = readDelegatedOutcome(matchUp ?? tournamentEngine.q?.matchUp?.({ matchUpId }));
  if (!delegatedOutcome) {
    tmxToast({ intent: 'is-warning', message: t('crowd.toast.noOutcomeToConfirm') });
    return;
  }
  mutationRequest({ methods: buildConfirmMethods({ matchUpId, drawId, delegatedOutcome }), callback });
}

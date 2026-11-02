/**
 * Bulk status: one status, set on many selected matchUps at once (a weather day).
 *
 * Only the statuses that need no score are offered: ABANDONED, CANCELLED and DOUBLE_WALKOVER. The batch is sent as a
 * single `bulkMatchUpStatusUpdate({ outcomes })`.
 *
 * ## Refused before the first write, never rolled back
 *
 * `bulkMatchUpStatusUpdate` locates every outcome before writing any, but the status itself is decided by
 * `setMatchUpStatus`, one outcome at a time: a refusal for a later outcome comes back after the earlier ones have been
 * written. The standing rule is to refuse before the first write rather than lean on `rollbackOnError`, so this
 * pre-check asks the factory about every row first, and the batch is sent only when no row would be refused.
 *
 * Two questions, both answered by the factory and neither re-derived here:
 *
 *   1. `matchUpActions` per row: the matchUp must offer SCORE (the same permission TMX asks before it opens score
 *      entry on a single row, `scoreActionPermitted`), and the status must not be among that action's
 *      `disabledMatchUpStatuses` (the scope registry the mutation itself consults).
 *   2. `dryRun` of the outcomes in the order they will be sent, each as its own directive so a refusal names its row.
 *      This is the mutation's own validation, against the record as the earlier outcomes in the batch leave it: a
 *      DOUBLE_WALKOVER ahead of a row changes what that row may become. A refused row is set aside and the rest are
 *      asked again, so the director hears about every refused row at once, not the first one only.
 */
import { BULK_MATCHUP_STATUS_UPDATE } from 'constants/mutationConstants';
import { matchUpStatusConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

const { ABANDONED, CANCELLED, DOUBLE_WALKOVER } = matchUpStatusConstants;

/** The statuses a bulk update may set: each one needs no score. */
export const BULK_MATCHUP_STATUSES: readonly string[] = [ABANDONED, CANCELLED, DOUBLE_WALKOVER];
const BULK_STATUS_SET = new Set(BULK_MATCHUP_STATUSES);

/** The fields of a matchUps-table row this flow reads. */
export type BulkStatusRow = {
  matchUpId: string;
  drawId: string;
  eventId: string;
  eventName?: string;
  roundName?: string;
  side1?: { participant?: { participantName?: string } };
  side2?: { participant?: { participantName?: string } };
  matchUp?: { tournamentId?: string };
};

export type BulkOutcome = {
  tournamentId: string;
  matchUpStatus: string;
  matchUpId: string;
  eventId: string;
  drawId: string;
};

/**
 * Why a row would be refused.
 *  - `notScorable`: the factory offers no SCORE action on it (a BYE, a matchUp still waiting for a participant, a
 *    carried exit).
 *  - `statusDisabled`: SCORE is offered but this status is out of scope for the matchUp.
 *  - `refused`: the mutation itself refuses it; `message` is the factory's.
 */
export type BulkRefusal = {
  reason: 'notScorable' | 'statusDisabled' | 'refused';
  row: BulkStatusRow;
  message?: string;
};

export type BulkPrecheck = {
  /** The batch to send; present only when no row is refused, since one refused row refuses the whole batch. */
  methods?: ReturnType<typeof bulkMatchUpStatusMethods>;
  outcomes: BulkOutcome[];
  refusals: BulkRefusal[];
};

export function isBulkMatchUpStatus(matchUpStatus: string): boolean {
  return BULK_STATUS_SET.has(matchUpStatus);
}

/** The outcome bulkMatchUpStatusUpdate takes for a row: ids only, never the hydrated matchUp. */
export function bulkOutcome(row: BulkStatusRow, matchUpStatus: string, tournamentId: string): BulkOutcome {
  return {
    tournamentId: row.matchUp?.tournamentId ?? tournamentId,
    matchUpId: row.matchUpId,
    eventId: row.eventId,
    drawId: row.drawId,
    matchUpStatus,
  };
}

export function bulkMatchUpStatusMethods(outcomes: BulkOutcome[]) {
  return [{ method: BULK_MATCHUP_STATUS_UPDATE, params: { outcomes } }];
}

/** The line a confirmation or refusal shows for a row: event, round and the two sides. */
export function describeBulkRow(row: BulkStatusRow): string {
  const sides = [row.side1, row.side2].map((side) => side?.participant?.participantName).filter(Boolean);
  const where = [row.eventName, row.roundName].filter(Boolean).join(' ');
  return [where, sides.join(' / ')].filter(Boolean).join(': ');
}

function errorMessage(result: any): string | undefined {
  const error = result?.error;
  const message = error?.message ?? (typeof error === 'string' ? error : undefined);
  const info = typeof result?.info === 'string' ? result.info : undefined;
  return [message, info].filter(Boolean).join(' — ') || undefined;
}

/** Question 1: what `matchUpActions` says about this status on this row; undefined when it is offered. */
function actionRefusal(row: BulkStatusRow, matchUpStatus: string): BulkRefusal | undefined {
  const result: any = tournamentEngine.matchUpActions({ drawId: row.drawId, matchUpId: row.matchUpId });
  if (result?.error) return { reason: 'refused', row, message: errorMessage(result) };
  const score = result?.validActions?.find(({ type }: any) => type === 'SCORE');
  if (!score) return { reason: 'notScorable', row };
  if (score.disabledMatchUpStatuses?.includes(matchUpStatus)) return { reason: 'statusDisabled', row };
  return undefined;
}

/** Question 2: the mutation's own answer, in batch order; every refused row is reported, not only the first. */
function dryRunRefusals(rows: BulkStatusRow[], outcomes: BulkOutcome[]): Omit<BulkPrecheck, 'methods'> {
  const refusals: BulkRefusal[] = [];
  const pending = rows.map((row, index) => ({ row, outcome: outcomes[index] }));

  while (pending.length) {
    const directives = pending.map(({ outcome }) => bulkMatchUpStatusMethods([outcome])[0]);
    // the factory writes into a directive's params as it runs; the batch that is sent must stay as built
    const preview: any = tournamentEngine.dryRun(structuredClone(directives));
    if (preview?.wouldSucceed) break;

    const results: any[] = preview?.results ?? [];
    const failed = results.length ? results.length - 1 : -1;
    if (failed < 0) {
      // refused before any directive ran: nothing in the batch can be sent
      const message = errorMessage(preview) ?? preview?.error?.message;
      refusals.push(...pending.map(({ row }) => ({ reason: 'refused' as const, row, message })));
      pending.length = 0;
      break;
    }
    refusals.push({ reason: 'refused', row: pending[failed].row, message: errorMessage(results[failed]) });
    pending.splice(failed, 1);
  }

  return { outcomes: pending.map(({ outcome }) => outcome), refusals };
}

/**
 * Ask the factory about every selected row before anything is sent.
 *
 * `methods` is the batch to send, and is present only when `refusals` is empty: one refused row refuses the whole
 * batch, since the outcomes that would be accepted were only accepted on the condition that the refused ones are left
 * out, and the director chose them together.
 */
export function precheckBulkMatchUpStatus({
  matchUpStatus,
  rows,
}: {
  matchUpStatus: string;
  rows: BulkStatusRow[];
}): BulkPrecheck {
  if (!isBulkMatchUpStatus(matchUpStatus)) {
    return { outcomes: [], refusals: rows.map((row) => ({ reason: 'statusDisabled', row })) };
  }
  const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;

  const refusals: BulkRefusal[] = [];
  const offered: BulkStatusRow[] = [];
  for (const row of rows) {
    const refusal = actionRefusal(row, matchUpStatus);
    if (refusal) refusals.push(refusal);
    else offered.push(row);
  }

  const outcomes = offered.map((row) => bulkOutcome(row, matchUpStatus, tournamentId));
  const mutation = offered.length ? dryRunRefusals(offered, outcomes) : { outcomes: [], refusals: [] };

  const allRefusals = [...refusals, ...mutation.refusals];
  const sendable = !allRefusals.length && mutation.outcomes.length > 0;
  return {
    outcomes: mutation.outcomes,
    refusals: allRefusals,
    ...(sendable ? { methods: bulkMatchUpStatusMethods(mutation.outcomes) } : {}),
  };
}

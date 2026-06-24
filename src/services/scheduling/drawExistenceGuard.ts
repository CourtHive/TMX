/**
 * Guard against scheduling a matchUp whose draw no longer exists — e.g. a draw
 * deleted by another client (or another tab on the same login) since the
 * matchUp was rendered. Dispatching addMatchUpScheduleItems for a missing draw
 * fails server-side with an opaque "Missing drawDefinition".
 *
 * Shared by both scheduling dispatch surfaces — the schedule2 grid
 * (gridView.ts) and the scheduling workspace (queueService.ts) — so the guard
 * behaves identically in each. The pure predicates take the existing-drawId set
 * as input so they stay engine-free and unit-testable; getExistingDrawIds is
 * the single engine-backed source for that set.
 */
import { competitionEngine } from 'services/factory/engine';

/**
 * Build the set of drawIds present across all loaded tournament records.
 * drawIds are globally unique, so a flat set across every loaded record is
 * safe for multi-tournament competition scheduling.
 */
export function getExistingDrawIds(): Set<string> {
  const drawIds = new Set<string>();
  const records = competitionEngine.getState()?.tournamentRecords ?? {};
  for (const tournamentRecord of Object.values(records) as any[]) {
    for (const event of tournamentRecord?.events ?? []) {
      for (const draw of event?.drawDefinitions ?? []) {
        if (draw?.drawId) drawIds.add(draw.drawId);
      }
    }
  }
  return drawIds;
}

/**
 * True when any method in a single drop's batch references a `drawId` absent
 * from `existingDrawIds`. A method with no drawId, or an empty-string drawId
 * (which an unschedule/clearSchedule carries), is never "missing": it cannot
 * trigger a server-side "Missing drawDefinition".
 */
export function batchReferencesMissingDraw(methods: any[], existingDrawIds: Set<string>): boolean {
  return methods.some((m) => {
    const drawId = m?.params?.drawId;
    return !!drawId && !existingDrawIds.has(drawId);
  });
}

/**
 * Partition queued bulk batches (each the method array produced by one drop)
 * into those safe to submit and those referencing a now-deleted draw.
 * Partitioning is by WHOLE batch so a swap's interdependent clear/assign
 * methods are never half-applied.
 */
export function partitionBatchesByDrawExistence(
  batches: any[][],
  existingDrawIds: Set<string>,
): { valid: any[][]; stale: any[][] } {
  const valid: any[][] = [];
  const stale: any[][] = [];
  for (const batch of batches) {
    if (batchReferencesMissingDraw(batch, existingDrawIds)) stale.push(batch);
    else valid.push(batch);
  }
  return { valid, stale };
}

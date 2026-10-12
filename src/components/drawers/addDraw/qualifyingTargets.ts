/**
 * Qualifying targets — the pure half of a target-aware "Add qualifying".
 *
 * The factory's `getAvailableQualifyingTargets` says, per round a main structure can be fed in, how
 * many drawPositions enter there, which qualifying structures already feed it and what they promise,
 * and two capacities: `structuralCapacity` (drawPositions less promised — the rule the factory's
 * attach enforces) and `remainingCapacity` (open positions less the qualifiers still owed and the
 * direct entries still unplaced). The offer, the clamp and the notice all read `remainingCapacity`:
 * a position holding a participant or a BYE is not room (CA, 2026-10-09), so a main whose positions
 * are all filled offers no qualifying until one is freed. Nothing here touches the DOM or the engine,
 * so the drawer's model and a node test can both use it.
 */
export type QualifyingTarget = {
  roundNumber: number;
  drawPositionsCount: number;
  unfilledPositionsCount: number;
  qualifierPositionsCount: number;
  unplacedDirectEntriesCount: number;
  placedQualifiersCount?: number;
  owedQualifiers?: number;
  feedingStructures: { structureId: string; structureName?: string; qualifiersCount: number; placeholder: boolean }[];
  promisedQualifiers: number;
  reservedQualifiers: number;
  structuralCapacity: number;
  remainingCapacity: number;
};

type Translate = (key: string, values?: Record<string, unknown>) => string;

/** Rounds with at least one open position a new qualifier could take. */
export function targetsWithCapacity(targets?: QualifyingTarget[]): QualifyingTarget[] {
  return (targets ?? []).filter((target) => target.remainingCapacity > 0);
}

/** The target the operator chose, or the first round still open when nothing (valid) was chosen. */
export function selectTarget(
  targets: QualifyingTarget[],
  requestedRound?: number | string,
): QualifyingTarget | undefined {
  const round = Number.parseInt(String(requestedRound ?? ''), 10);
  return targets.find((target) => target.roundNumber === round) ?? targets[0];
}

/** Clamp a requested qualifiers count into [1, remainingCapacity]; with no target the request stands (floored at 1). */
export function clampToTarget(requested: number, target?: QualifyingTarget): number {
  const floor = Math.max(1, Number.isFinite(requested) ? requested : 1);
  if (!target || target.remainingCapacity <= 0) return floor;
  return Math.min(floor, target.remainingCapacity);
}

/** Real (non-placeholder) structures already feeding the target, oldest first as the links list them. */
export function feedersOf(target: QualifyingTarget): QualifyingTarget['feedingStructures'] {
  return target.feedingStructures.filter((feeder) => !feeder.placeholder);
}

/** "Round 2 — 4 of 4 positions open" */
export function targetOptionLabel(target: QualifyingTarget, t: Translate): string {
  return t('drawers.addDraw.targetRoundOption', {
    total: target.drawPositionsCount,
    open: target.remainingCapacity,
    round: target.roundNumber,
  });
}

/** What already feeds the chosen round, and how much room is left — or that nothing feeds it yet. */
export function targetNotice(target: QualifyingTarget, t: Translate): string {
  const feeders = feedersOf(target);
  const room = t('drawers.addDraw.targetCapacity', {
    open: target.remainingCapacity,
    total: target.drawPositionsCount,
    round: target.roundNumber,
  });
  if (!feeders.length) return `${t('drawers.addDraw.noFeeders', { round: target.roundNumber })} ${room}`;
  const feederNames = feeders
    .map((feeder) => `${feeder.structureName ?? t('drawers.addDraw.qualifying')} (${feeder.qualifiersCount})`)
    .join(', ');
  return `${t('drawers.addDraw.alreadyFed', { round: target.roundNumber, feederNames, count: target.promisedQualifiers })} ${room}`;
}

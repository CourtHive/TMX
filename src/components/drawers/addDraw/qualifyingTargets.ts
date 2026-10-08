/**
 * Qualifying targets — the pure half of a target-aware "Add qualifying".
 *
 * The factory's `getAvailableQualifyingTargets` says, per round a main structure can be fed in, how
 * many drawPositions enter there, which qualifying structures already feed it and what they promise,
 * and two capacities: `structuralCapacity` (drawPositions less promised — the rule the factory's
 * attach enforces) and `remainingCapacity` (what the draw as placed today can still hold). Nothing
 * here touches the DOM or the engine, so the drawer's model and a node test can both use it.
 */
export type QualifyingTarget = {
  roundNumber: number;
  drawPositionsCount: number;
  unfilledPositionsCount: number;
  qualifierPositionsCount: number;
  unplacedDirectEntriesCount: number;
  feedingStructures: { structureId: string; structureName?: string; qualifiersCount: number; placeholder: boolean }[];
  promisedQualifiers: number;
  reservedQualifiers: number;
  structuralCapacity: number;
  remainingCapacity: number;
};

type Translate = (key: string, values?: Record<string, unknown>) => string;

/** Rounds that can still take at least one qualifier. */
export function targetsWithCapacity(targets?: QualifyingTarget[]): QualifyingTarget[] {
  return (targets ?? []).filter((target) => target.structuralCapacity > 0);
}

/** The target the operator chose, or the first round still open when nothing (valid) was chosen. */
export function selectTarget(
  targets: QualifyingTarget[],
  requestedRound?: number | string,
): QualifyingTarget | undefined {
  const round = Number.parseInt(String(requestedRound ?? ''), 10);
  return targets.find((target) => target.roundNumber === round) ?? targets[0];
}

/** Clamp a requested qualifiers count into [1, structuralCapacity]; with no target the request stands (floored at 1). */
export function clampToTarget(requested: number, target?: QualifyingTarget): number {
  const floor = Math.max(1, Number.isFinite(requested) ? requested : 1);
  if (!target || target.structuralCapacity <= 0) return floor;
  return Math.min(floor, target.structuralCapacity);
}

/** Real (non-placeholder) structures already feeding the target, oldest first as the links list them. */
export function feedersOf(target: QualifyingTarget): QualifyingTarget['feedingStructures'] {
  return target.feedingStructures.filter((feeder) => !feeder.placeholder);
}

/** "Round 2 — 4 of 4 positions open" */
export function targetOptionLabel(target: QualifyingTarget, t: Translate): string {
  return t('drawers.addDraw.targetRoundOption', {
    total: target.drawPositionsCount,
    open: target.structuralCapacity,
    round: target.roundNumber,
  });
}

/** What already feeds the chosen round, and how much room is left — or that nothing feeds it yet. */
export function targetNotice(target: QualifyingTarget, t: Translate): string {
  const feeders = feedersOf(target);
  const room = t('drawers.addDraw.targetCapacity', {
    open: target.structuralCapacity,
    total: target.drawPositionsCount,
    round: target.roundNumber,
  });
  if (!feeders.length) return `${t('drawers.addDraw.noFeeders', { round: target.roundNumber })} ${room}`;
  const feederNames = feeders
    .map((feeder) => `${feeder.structureName ?? t('drawers.addDraw.qualifying')} (${feeder.qualifiersCount})`)
    .join(', ');
  return `${t('drawers.addDraw.alreadyFed', { round: target.roundNumber, feederNames, count: target.promisedQualifiers })} ${room}`;
}

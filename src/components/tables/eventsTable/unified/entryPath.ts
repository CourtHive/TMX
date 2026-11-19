/**
 * The path a QUALIFYING entry takes to MAIN, as the topology builder wrote it on Generate (CA, 2026-11-18,
 * Mentat/planning/2026-11-17-qualifying-entry-routing.md decision 4): its depth in a qualifying chain
 * (`entryStageSequence`, 1 the deepest) and the MAIN round the chain leads to (`roundTarget`). The entries page shows
 * it read-only; the builder alone decides it.
 *
 * Generate writes a path only where one qualifying structure could not say it alone (more than one band, or a target
 * after round 1). Where none is written the draw has one qualifying path, the factory's default, and every QUALIFYING
 * entry shows it: `Qualifying · R1` (CA, 2026-11-19: an empty column read as missing data).
 */
import { drawDefinitionConstants, extensionConstants } from 'tods-competition-factory';
import { depthLabel } from 'courthive-components';

const { QUALIFYING } = drawDefinitionConstants;
const { ROUND_TARGET } = extensionConstants;

type PathEntry = {
  participantId: string;
  entryStage?: string;
  entryStageSequence?: number;
  roundTarget?: number;
  extensions?: any[];
};

/** The MAIN round an entry's path leads to: its own attribute, else the extension the factory records it in. */
export function entryRoundTarget(entry: PathEntry): number | undefined {
  return entry.roundTarget ?? entry.extensions?.find(({ name }) => name === ROUND_TARGET)?.value;
}

/**
 * Each QUALIFYING entry's path, by participantId: `Qualifying · R3`, `Pre-qualifying → Qualifying · R1`. A chain's
 * length is the deepest sequence among the entries leading to the same MAIN round, so an entry's depth is how far it
 * starts from MAIN: in a chain of two, sequence 1 is pre-qualifying and sequence 2 qualifying.
 */
export function qualifyingPathLabels(entries: PathEntry[]): Map<string, string> {
  const routed = entries
    .filter((entry) => entry.entryStage === QUALIFYING)
    .map((entry) => ({ entry, roundTarget: entryRoundTarget(entry), sequence: entry.entryStageSequence }))
    .filter(({ roundTarget, sequence }) => roundTarget !== undefined || sequence !== undefined);

  // nothing written: the one default path, qualifying into MAIN's first round
  if (!routed.length) {
    const unrouted = entries.filter((entry) => entry.entryStage === QUALIFYING);
    if (!unrouted.length) return new Map();
    const label = `${depthLabel(1)} · R1`;
    return new Map(unrouted.map((entry) => [entry.participantId, label]));
  }

  const chainLength = new Map<number, number>();
  for (const { roundTarget = 1, sequence = 1 } of routed)
    chainLength.set(roundTarget, Math.max(chainLength.get(roundTarget) ?? 1, sequence));

  const labels = new Map<string, string>();
  for (const { entry, roundTarget = 1, sequence = 1 } of routed) {
    const depth = (chainLength.get(roundTarget) ?? 1) - sequence + 1;
    const steps = Array.from({ length: depth }, (_, i) => depthLabel(depth - i));
    labels.set(entry.participantId, `${steps.join(' → ')} · R${roundTarget}`);
  }
  return labels;
}

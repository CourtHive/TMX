import { entryRoundTarget, qualifyingPathLabels } from './entryPath';
import { describe, expect, it } from 'vitest';

const QUALIFYING_R3 = 'Qualifying · R3';
const QUALIFYING_R1 = 'Qualifying · R1';

const q = (participantId: string, entryStageSequence?: number, roundTarget?: number) => ({
  participantId,
  entryStage: 'QUALIFYING',
  ...(entryStageSequence !== undefined && { entryStageSequence }),
  ...(roundTarget !== undefined && { roundTarget }),
});

describe('the Path column (CA, 2026-11-18): each qualifying entry path, read-only', () => {
  it('a stronger field to R3 and a weaker to R1, one structure each', () => {
    const labels = qualifyingPathLabels([q('s1', 1, 3), q('w1', 1, 1)]);
    expect(labels.get('s1')).toBe(QUALIFYING_R3);
    expect(labels.get('w1')).toBe(QUALIFYING_R1);
  });

  it('a pre-qualifying chain: sequence 1 is pre-qualifying, sequence 2 qualifying', () => {
    const labels = qualifyingPathLabels([q('pre', 1, 1), q('qual', 2, 1)]);
    expect(labels.get('pre')).toBe('Pre-qualifying → Qualifying · R1');
    expect(labels.get('qual')).toBe(QUALIFYING_R1);
  });

  it("each MAIN round's chain is its own: a pre-qualifying chain to R1 beside a single structure to R3", () => {
    const labels = qualifyingPathLabels([q('pre', 1, 1), q('qual', 2, 1), q('strong', 1, 3)]);
    expect(labels.get('strong')).toBe(QUALIFYING_R3);
    expect(labels.get('pre')).toBe('Pre-qualifying → Qualifying · R1');
  });

  it("reads the round target from the factory's extension", () => {
    const entry = { ...q('e', 1), extensions: [{ name: 'roundTarget', value: 3 }] };
    expect(entryRoundTarget(entry)).toBe(3);
    expect(qualifyingPathLabels([entry]).get('e')).toBe(QUALIFYING_R3);
  });

  it('MAIN entries have none', () => {
    const labels = qualifyingPathLabels([
      { participantId: 'm', entryStage: 'MAIN', entryStageSequence: 1, roundTarget: 1 },
      q('routed', 1, 3),
    ]);
    expect(labels.has('m')).toBe(false);
  });

  it('with no path written, every qualifying entry shows the one default path (CA, 2026-11-19)', () => {
    const labels = qualifyingPathLabels([{ participantId: 'm', entryStage: 'MAIN' }, q('a'), q('b')]);
    expect(labels.get('a')).toBe(QUALIFYING_R1);
    expect(labels.get('b')).toBe(QUALIFYING_R1);
    expect(labels.has('m')).toBe(false);
  });

  it('beside written paths, an entry with none shows none: its path is not the default one', () => {
    const labels = qualifyingPathLabels([q('routed', 1, 3), q('unrouted')]);
    expect(labels.get('routed')).toBe(QUALIFYING_R3);
    expect(labels.has('unrouted')).toBe(false);
  });
});

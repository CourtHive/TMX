import { beforeEach, describe, expect, it, vi } from 'vitest';

// courthive-components imports CSS side-effects that touch `document` at module load, and TMX's
// vitest config has no DOM environment. `isScorable`'s OWN behaviour — the format clause, the
// pair-name path, every refusal case — is tested in courthive-components, which owns it. What this
// file asserts is TMX's WIRING: that the promotion consults that gate rather than a local
// approximation of it.
const isScorable = vi.fn();
vi.mock('courthive-components', () => ({ isScorable: (m: any) => isScorable(m) }));

import { markReadyMatchUpsInProgress } from './markReadyMatchUpsInProgress';

const ready = (matchUpId: string) => ({ matchUpId, readyToScore: true, matchUpStatus: 'TO_BE_PLAYED' });

describe('markReadyMatchUpsInProgress', () => {
  // Without this the call-count assertion below accumulates across tests — it caught exactly that.
  beforeEach(() => isScorable.mockReset());
  it('promotes a ready matchUp the gate admits', () => {
    isScorable.mockReturnValue(true);
    const m: any = ready('m1');
    markReadyMatchUpsInProgress([m]);
    expect(m.matchUpStatus).toBe('IN_PROGRESS');
  });

  it('does NOT promote a matchUp the gate refuses', () => {
    // The point of the change. Promoting to IN_PROGRESS is what makes applyInlineScoringWrappers pick
    // a matchUp up, and renderInlineMatchUp then refuses it — leaving a draw that shows a match as in
    // progress with no way to score it.
    isScorable.mockReturnValue(false);
    const m: any = ready('m2');
    markReadyMatchUpsInProgress([m]);
    expect(m.matchUpStatus).toBe('TO_BE_PLAYED');
  });

  it('consults the gate for every matchUp, not just the first', () => {
    isScorable.mockReturnValue(true);
    markReadyMatchUpsInProgress([ready('a'), ready('b'), ready('c')] as any[]);
    expect(isScorable).toHaveBeenCalledTimes(3);
  });

  it('leaves a matchUp that already has a winner alone', () => {
    isScorable.mockReturnValue(true);
    const m: any = { ...ready('m3'), winningSide: 1 };
    markReadyMatchUpsInProgress([m]);
    expect(m.matchUpStatus).toBe('TO_BE_PLAYED');
  });

  it('leaves a matchUp that is not readyToScore alone', () => {
    isScorable.mockReturnValue(true);
    const m: any = { matchUpId: 'm4', matchUpStatus: 'TO_BE_PLAYED' };
    markReadyMatchUpsInProgress([m]);
    expect(m.matchUpStatus).toBe('TO_BE_PLAYED');
  });

  it('survives an empty or absent list', () => {
    expect(() => markReadyMatchUpsInProgress([])).not.toThrow();
    expect(() => markReadyMatchUpsInProgress(undefined as any)).not.toThrow();
  });
});

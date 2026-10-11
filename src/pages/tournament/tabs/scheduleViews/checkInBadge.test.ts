/**
 * Catalog check-in badge — the pure model.
 *
 * **Every case is built through `getMatchUpCheckInState` rather than by hand-writing a
 * `MatchUpCheckInState` literal.** A literal would let this suite pass against a badge that reads a
 * field the real derivation never populates; routing through the real function means the fixture is a
 * matchUp shape the factory actually produces.
 *
 * **And every meaningful case is DOUBLES.** The partial — one of two partners at the desk — is the
 * whole reason the badge exists. A singles fixture cannot express it, so a singles-only suite would
 * pass against an implementation that rendered a plain tick.
 */
import { checkInBadgeModel } from './checkInBadge';
import { getMatchUpCheckInState } from 'services/checkIn/checkInState';
import { doublesMatchUp } from 'services/checkIn/checkInTestMatchUps';
import { describe, expect, it } from 'vitest';

const modelFor = (checkedIn: string[]) => checkInBadgeModel(getMatchUpCheckInState(doublesMatchUp(checkedIn)));

describe('checkInBadgeModel', () => {
  it('renders the partial as a count, never as a tick — the state the desk manages', () => {
    const model = modelFor(['p1']);
    expect(model).not.toBeNull();
    expect(model?.text).toBe('1/4');
    expect(model?.tone).toBe('partial');
    expect(model?.count).toBe(1);
    expect(model?.total).toBe(4);
  });

  it('distinguishes three-of-four from complete', () => {
    // The case a boolean collapses: everyone but one partner is standing at the desk.
    expect(modelFor(['p1', 'p2', 'p3'])?.tone).toBe('partial');
    expect(modelFor(['p1', 'p2', 'p3'])?.text).toBe('3/4');
    expect(modelFor(['p1', 'p2', 'p3', 'p4'])?.tone).toBe('complete');
    expect(modelFor(['p1', 'p2', 'p3', 'p4'])?.text).toBe('4/4');
  });

  it('says nothing when nobody has checked in yet', () => {
    // At the start of a day this is every match in the catalog. A 0/4 on all of them is noise
    // exactly when the operator most needs to scan.
    expect(modelFor([])).toBeNull();
  });

  it('says nothing for a matchUp with no participants', () => {
    // An unfilled draw position: nobody COULD check in, so the absence is not a signal.
    expect(checkInBadgeModel(getMatchUpCheckInState({ sides: [] }))).toBeNull();
  });

  it('counts each half of a pair, and reads a legacy PAIR check-in as both halves', () => {
    // D4c: since factory 7.0.0 only an individual can be checked in. A PAIR-level check-in written
    // before then is read, by the factory's rule, as both of its members being present.
    expect(modelFor(['pair1'])?.text).toBe('2/4');
    expect(modelFor(['p1', 'p2'])?.text).toBe('2/4');
  });
});

import { describe, it, expect } from 'vitest';

import { defaultStructureId, hasUnenteredScores } from './defaultStructureId';

const done = (id: string) => ({ matchUpId: id, matchUpStatus: 'COMPLETED', winningSide: 1 });
const open = (id: string) => ({ matchUpId: id, matchUpStatus: 'TO_BE_PLAYED' });

const qualifying = (...matchUps: any[]) => ({
  structureId: 'q',
  stage: 'QUALIFYING',
  roundMatchUps: { 1: matchUps },
});
const main = (...matchUps: any[]) => ({ structureId: 'm', stage: 'MAIN', roundMatchUps: { 1: matchUps } });

describe('defaultStructureId — open on the structure that still needs scores', () => {
  it('opens MAIN once every qualifying score is entered', () => {
    expect(defaultStructureId([qualifying(done('q1'), done('q2')), main(open('m1'))])).toBe('m');
  });

  it('opens QUALIFYING while it still has a score to enter', () => {
    expect(defaultStructureId([qualifying(done('q1'), open('q2')), main(open('m1'))])).toBe('q');
  });

  it('opens MAIN even when main is complete too — qualifying is passed over, never preferred', () => {
    expect(defaultStructureId([qualifying(done('q1')), main(done('m1'))])).toBe('m');
  });

  it('keeps qualifying first while it has no matchUps yet, since generating it is the next step', () => {
    expect(defaultStructureId([{ structureId: 'q', stage: 'QUALIFYING', roundMatchUps: {} }, main()])).toBe('q');
  });

  it('passes over several completed qualifying structures, in order', () => {
    const q1 = { ...qualifying(done('a')), structureId: 'q1' };
    const q2 = { ...qualifying(open('b')), structureId: 'q2' };
    expect(defaultStructureId([q1, q2, main(open('m1'))])).toBe('q2');
  });

  it('is the first structure when there is no qualifying, as it always was', () => {
    const consolation = { structureId: 'c', stage: 'CONSOLATION', roundMatchUps: { 1: [open('c1')] } };
    expect(defaultStructureId([main(done('m1')), consolation])).toBe('m');
  });

  it('falls back to the first structure when only completed qualifying exists', () => {
    expect(defaultStructureId([qualifying(done('q1'))])).toBe('q');
  });

  it('is undefined with no structures', () => {
    expect(defaultStructureId(undefined)).toBeUndefined();
    expect(defaultStructureId([])).toBeUndefined();
  });
});

describe('hasUnenteredScores', () => {
  it('a BYE and every completed status need no score', () => {
    for (const matchUpStatus of ['BYE', 'WALKOVER', 'RETIRED', 'DEFAULTED', 'DOUBLE_WALKOVER', 'CANCELLED']) {
      expect(hasUnenteredScores(qualifying({ matchUpId: 'x', matchUpStatus })), matchUpStatus).toBe(false);
    }
  });

  it('in progress, suspended or not yet played still need one', () => {
    for (const matchUpStatus of ['IN_PROGRESS', 'SUSPENDED', 'TO_BE_PLAYED', 'AWAITING_RESULT']) {
      expect(hasUnenteredScores(qualifying({ matchUpId: 'x', matchUpStatus })), matchUpStatus).toBe(true);
    }
  });

  it('reads a flat matchUps list as well as roundMatchUps', () => {
    expect(hasUnenteredScores({ matchUps: [done('a')] })).toBe(false);
    expect(hasUnenteredScores({ matchUps: [open('a')] })).toBe(true);
  });
});

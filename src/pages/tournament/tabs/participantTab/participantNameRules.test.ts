import { nameIsAcceptable, participantNamesValid } from './participantNameRules';
import { describe, expect, it } from 'vitest';

describe('participantNamesValid', () => {
  it('accepts a full name of at least two characters each', () => {
    expect(participantNamesValid({ firstName: 'Ana', lastName: 'Li' })).toEqual(true);
  });

  it('refuses a one-character name even beside a nickname, since the factory would refuse it', () => {
    expect(participantNamesValid({ firstName: 'A', lastName: 'Rivas', nickname: 'Ace' })).toEqual(false);
    expect(participantNamesValid({ firstName: 'Ana', lastName: ' R ', nickname: 'Ace' })).toEqual(false);
  });

  it('accepts a nickname alone, with the names empty', () => {
    expect(participantNamesValid({ firstName: '', lastName: '  ', nickname: 'Ace' })).toEqual(true);
    expect(participantNamesValid({ firstName: '', lastName: '', nickname: 'A' })).toEqual(false);
  });

  it('accepts a stored one-character name sent back unchanged', () => {
    const stored = { firstName: 'Q', lastName: 'Rivas' };
    expect(participantNamesValid({ firstName: 'Q', lastName: 'Rivas' }, stored)).toEqual(true);
    expect(participantNamesValid({ firstName: 'Z', lastName: 'Rivas' }, stored)).toEqual(false);
  });

  it('measures the name as stored: whitespace collapsed and trimmed', () => {
    expect(nameIsAcceptable('  A  ')).toEqual(false);
    expect(nameIsAcceptable(' A  B ')).toEqual(true);
    expect(nameIsAcceptable('')).toEqual(true);
  });
});

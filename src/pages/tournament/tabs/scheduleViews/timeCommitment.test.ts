import { commitmentOf } from './timeCommitment';
import { describe, expect, it } from 'vitest';

describe('commitmentOf', () => {
  it('reads a bare time as a firm start', () => {
    expect(commitmentOf({ scheduledTime: '14:30' })).toBe('firm');
    expect(commitmentOf({ scheduledTime: '14:30', timeModifiers: [] })).toBe('firm');
  });

  it('states no time when there is none', () => {
    expect(commitmentOf({})).toBe('none');
    expect(commitmentOf(undefined)).toBe('none');
    expect(commitmentOf({ timeModifiers: ['NOT_BEFORE'] })).toBe('none');
  });

  it('reads NOT_BEFORE as a floor, not a withdrawal', () => {
    // The only annotation the engine lets stand beside a live time — and it
    // makes the time MORE binding: nothing may start earlier than it.
    expect(commitmentOf({ scheduledTime: '14:30', timeModifiers: ['NOT_BEFORE'] })).toBe('floor');
  });

  it('reads the mutually-exclusive annotations as withdrawing the time', () => {
    for (const modifier of ['FOLLOWED_BY', 'NEXT_AVAILABLE', 'AFTER_REST', 'TO_BE_ANNOUNCED']) {
      expect(commitmentOf({ scheduledTime: '14:30', timeModifiers: [modifier] })).toBe('none');
    }
  });

  it('lets a withdrawal beat a floor when a record carries both', () => {
    // The engine will not produce this pair. If legacy data does, the safer
    // reading is "no time stated" rather than "a floor at that time".
    expect(commitmentOf({ scheduledTime: '14:30', timeModifiers: ['NOT_BEFORE', 'TO_BE_ANNOUNCED'] })).toBe('none');
  });

  it('ignores an annotation it does not know', () => {
    expect(commitmentOf({ scheduledTime: '14:30', timeModifiers: ['SOMETHING_NEW'] })).toBe('firm');
  });
});

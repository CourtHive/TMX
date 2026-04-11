import { mergeParticipantDrafts } from './mergeParticipantDrafts';
import { describe, expect, it } from 'vitest';

const CITY_LA = 'Los Angeles';
const CITY_BELL_CANYON = 'Bell Canyon';
const STATE_CA = 'CA';
const NAME_LINCOLN = 'Lincoln Bellamy';
const UTR_ITEM_TYPE = 'SCALE.RATING.SINGLES.UTR';

const baseDraft = (overrides: any = {}) => ({
  participantType: 'INDIVIDUAL',
  participantRole: 'COMPETITOR',
  person: {},
  ...overrides,
});

describe('mergeParticipantDrafts', () => {
  it('returns undefined for empty input', () => {
    expect(mergeParticipantDrafts([])).toBeUndefined();
  });

  it('returns the single draft unchanged when only one is given', () => {
    const draft = baseDraft({ participantName: 'Alice' });
    expect(mergeParticipantDrafts([draft])).toBe(draft);
  });

  it('merges scalar person fields with last-truthy-wins', () => {
    const drafts = [
      baseDraft({ person: { standardGivenName: 'Alice', standardFamilyName: 'Smith' } }),
      baseDraft({ person: { standardGivenName: 'Alice', standardFamilyName: 'Jones', sex: 'FEMALE' } }),
    ];
    const merged = mergeParticipantDrafts(drafts);
    expect(merged.person.standardGivenName).toBe('Alice');
    expect(merged.person.standardFamilyName).toBe('Jones');
    expect(merged.person.sex).toBe('FEMALE');
  });

  it('preserves earlier-set address fields when a later draft is partial', () => {
    // The bug fix: a later "TBD"-style row produces a city-only address with no state.
    // The merged draft must keep the state set by the earlier full address.
    const drafts = [
      baseDraft({
        person: { addresses: [{ city: CITY_LA, state: STATE_CA }] },
      }),
      baseDraft({
        person: { addresses: [{ city: CITY_BELL_CANYON, state: STATE_CA }] },
      }),
      baseDraft({
        person: { addresses: [{ city: 'TBD' }] },
      }),
    ];
    const merged = mergeParticipantDrafts(drafts);
    expect(merged.person.addresses).toHaveLength(1);
    expect(merged.person.addresses[0].city).toBe('TBD');
    expect(merged.person.addresses[0].state).toBe(STATE_CA);
  });

  it('preserves contact fields across partial later drafts', () => {
    const drafts = [
      baseDraft({ person: { contacts: [{ emailAddress: 'a@x', telephone: '555-1111' }] } }),
      baseDraft({ person: { contacts: [{ emailAddress: 'a@x', mobileTelephone: '555-2222' }] } }),
    ];
    const merged = mergeParticipantDrafts(drafts);
    expect(merged.person.contacts[0].emailAddress).toBe('a@x');
    expect(merged.person.contacts[0].telephone).toBe('555-1111');
    expect(merged.person.contacts[0].mobileTelephone).toBe('555-2222');
  });

  it('skips empty / null / undefined values when merging', () => {
    const drafts = [
      baseDraft({ person: { sex: 'MALE', birthDate: '2000-01-01' } }),
      baseDraft({ person: { sex: '', birthDate: null } }),
      baseDraft({ person: { sex: undefined } }),
    ];
    const merged = mergeParticipantDrafts(drafts);
    expect(merged.person.sex).toBe('MALE');
    expect(merged.person.birthDate).toBe('2000-01-01');
  });

  it('takes the last non-empty array wholesale for non-special arrays', () => {
    const drafts = [
      baseDraft({ timeItems: [{ itemType: UTR_ITEM_TYPE, itemValue: { utrRating: 8 } }] }),
      baseDraft({ timeItems: [{ itemType: UTR_ITEM_TYPE, itemValue: { utrRating: 9 } }] }),
    ];
    const merged = mergeParticipantDrafts(drafts);
    expect(merged.timeItems).toEqual([{ itemType: UTR_ITEM_TYPE, itemValue: { utrRating: 9 } }]);
  });

  it('drops participantId so the caller can recompute it from merged name', () => {
    const drafts = [
      baseDraft({ participantId: 'XXX-1', participantName: 'A B' }),
      baseDraft({ participantId: 'XXX-2', participantName: 'A B' }),
    ];
    const merged = mergeParticipantDrafts(drafts);
    expect(merged.participantId).toBeUndefined();
    expect(merged.participantName).toBe('A B');
  });

  it('handles a 2-draft group where one row has city+state and the other has city only', () => {
    // Scenario: Steve Bellamy submits twice. First submission has full address,
    // second has only the city. The merge should preserve state from the first.
    const drafts = [
      baseDraft({
        participantName: 'Steve Bellamy',
        person: { addresses: [{ city: CITY_BELL_CANYON, state: STATE_CA }] },
      }),
      baseDraft({
        participantName: 'Steve Bellamy',
        person: { addresses: [{ city: CITY_BELL_CANYON }] },
      }),
    ];
    const merged = mergeParticipantDrafts(drafts);
    expect(merged.person.addresses[0].city).toBe(CITY_BELL_CANYON);
    expect(merged.person.addresses[0].state).toBe(STATE_CA);
  });

  it('reproduces the TYPTI Lincoln Bellamy scenario end-to-end', () => {
    // Six rows, all the same email; later rows are placeholder/incomplete.
    // The merged draft must show the most recent real city AND a state that was
    // set by an earlier row but absent from the most recent rows.
    const drafts = [
      baseDraft({
        participantName: NAME_LINCOLN,
        person: { addresses: [{ city: CITY_LA, state: STATE_CA }] },
      }),
      baseDraft({
        participantName: NAME_LINCOLN,
        person: { addresses: [{ city: CITY_LA, state: STATE_CA }] },
      }),
      baseDraft({
        participantName: NAME_LINCOLN,
        person: { addresses: [{ city: CITY_BELL_CANYON, state: STATE_CA }] },
      }),
      baseDraft({
        participantName: NAME_LINCOLN,
        person: { addresses: [{ city: 'LA', state: STATE_CA }] },
      }),
      baseDraft({
        participantName: NAME_LINCOLN,
        person: { addresses: [{ city: CITY_BELL_CANYON, state: STATE_CA }] },
      }),
      baseDraft({
        participantName: NAME_LINCOLN,
        person: { addresses: [{ city: 'TBD' }] },
      }),
    ];
    const merged = mergeParticipantDrafts(drafts);
    expect(merged.person.addresses[0].city).toBe('TBD');
    expect(merged.person.addresses[0].state).toBe(STATE_CA);
  });
});

import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  buildEntryProfileMethod,
  entryProfileFormValues,
  readEntryProfileForm,
  entryProfileFields,
  ENTRY_PROFILE_FIELDS,
} from './eventEntryProfile';

// constants
import { MODIFY_EVENT } from 'constants/mutationConstants';

function seedEvent() {
  const {
    eventIds: [eventId],
  } = mocksEngine.generateTournamentRecord({
    eventProfiles: [{ participantsProfile: { participantsCount: 20 } }],
    setState: true,
  });
  return eventId;
}

const getEvent = (eventId: string) => tournamentEngine.getEvent({ eventId }).event;
const save = (eventId: string, form: any) => {
  const { entryProfile, refusal } = readEntryProfileForm({ form, event: getEvent(eventId) });
  expect(refusal).toBeUndefined();
  const method = buildEntryProfileMethod({ eventId, entryProfile });
  if (!method) return undefined;
  const result: any = tournamentEngine.executionQueue([method]);
  expect(result.success).toEqual(true);
  return method;
};

describe('entry profile form values', () => {
  it('blank for an event with no profile, the stored sizes otherwise', () => {
    expect(entryProfileFormValues({})).toEqual({
      entriesLimit: '',
      targetDrawSize: '',
      qualifiersCount: '',
      qualifyingDrawSize: '',
      wildcardCount: '',
    });
    expect(entryProfileFormValues({ entryProfile: { targetDrawSize: 32, wildcardCount: 0 } })).toMatchObject({
      targetDrawSize: '32',
      wildcardCount: '0',
    });
  });

  it('an event with multi-structure qualifying does not show the simple qualifying sizes', () => {
    const event = { entryProfile: { qualifyingProfiles: [{ structureProfiles: [{ drawSize: 16 }] }] } };
    expect(entryProfileFields(event)).toEqual(['entriesLimit', 'targetDrawSize', 'wildcardCount']);
    expect(entryProfileFields({})).toEqual([...ENTRY_PROFILE_FIELDS]);
  });
});

describe('reading the form', () => {
  it('sends only what changed; a cleared field removes the key; nothing changed sends nothing', () => {
    const event = { entryProfile: { targetDrawSize: 32, wildcardCount: 2, selectionProcess: 'TOP_DOWN_BY_RATING' } };
    expect(readEntryProfileForm({ form: { targetDrawSize: '32', wildcardCount: '2' }, event })).toEqual({});
    expect(readEntryProfileForm({ form: { targetDrawSize: ' 16 ', wildcardCount: '' }, event })).toEqual({
      entryProfile: { targetDrawSize: 16, wildcardCount: null },
    });
  });

  it('refuses what the factory would refuse', () => {
    const refusal = (form: any, event?: any) => readEntryProfileForm({ form, event }).refusal;
    expect(refusal({ targetDrawSize: '0' })).toEqual('NOT_A_WHOLE_NUMBER');
    expect(refusal({ targetDrawSize: '12.5' })).toEqual('NOT_A_WHOLE_NUMBER');
    expect(refusal({ entriesLimit: 'many' })).toEqual('NOT_A_WHOLE_NUMBER');
    expect(refusal({ wildcardCount: '-1' })).toEqual('NOT_A_WHOLE_NUMBER');
    expect(refusal({ wildcardCount: '0', qualifiersCount: '0' })).toBeUndefined();
    expect(refusal({ qualifyingDrawSize: '16', qualifiersCount: '16' })).toEqual(
      'QUALIFIERS_NOT_FEWER_THAN_QUALIFYING_DRAW',
    );
    expect(refusal({ targetDrawSize: '8', qualifiersCount: '4', wildcardCount: '5' })).toEqual(
      'RESERVED_PLACES_EXCEED_DRAW',
    );
    // checked against the stored sizes the form leaves alone
    expect(refusal({ wildcardCount: '5' }, { entryProfile: { targetDrawSize: 8, qualifiersCount: 4 } })).toEqual(
      'RESERVED_PLACES_EXCEED_DRAW',
    );
    // a cleared size no longer constrains
    expect(
      refusal({ targetDrawSize: '', wildcardCount: '5' }, { entryProfile: { targetDrawSize: 4 } }),
    ).toBeUndefined();
  });

  it('builds no method without an update', () => {
    expect(buildEntryProfileMethod({ eventId: 'e' })).toBeUndefined();
    expect(buildEntryProfileMethod({ eventId: 'e', entryProfile: { targetDrawSize: 32 } })).toEqual({
      method: MODIFY_EVENT,
      params: { eventId: 'e', eventUpdates: { entryProfile: { targetDrawSize: 32 } } },
    });
  });
});

describe('saving through the engine', () => {
  it('modifyEvent stores the sizes, keeps what the drawer does not show, and the entry space counts from them', () => {
    const eventId = seedEvent();
    let result: any = tournamentEngine.modifyEvent({
      eventUpdates: { entryProfile: { selectionProcess: 'TOP_DOWN_BY_RATING' } },
      eventId,
    });
    expect(result.success).toEqual(true);

    save(eventId, {
      entriesLimit: '40',
      targetDrawSize: '32',
      qualifiersCount: '4',
      qualifyingDrawSize: '16',
      wildcardCount: '3',
    });
    expect(getEvent(eventId).entryProfile).toEqual({
      selectionProcess: 'TOP_DOWN_BY_RATING',
      entriesLimit: 40,
      targetDrawSize: 32,
      qualifiersCount: 4,
      qualifyingDrawSize: 16,
      wildcardCount: 3,
    });

    result = tournamentEngine.getEventEntrySpace({ eventId });
    expect(result).toMatchObject({ drawPositions: 32, qualifierPositions: 4, wildcardPositions: 3, openPlaces: 5 });

    // clearing the qualifying sizes frees the qualifier places
    save(eventId, {
      entriesLimit: '40',
      targetDrawSize: '32',
      qualifiersCount: '',
      qualifyingDrawSize: '',
      wildcardCount: '3',
    });
    expect(getEvent(eventId).entryProfile.qualifiersCount).toBeUndefined();
    result = tournamentEngine.getEventEntrySpace({ eventId });
    expect(result).toMatchObject({ qualifierPositions: 0, openPlaces: 9 });
  });

  it('an unchanged form sends nothing', () => {
    const eventId = seedEvent();
    save(eventId, { targetDrawSize: '32' });
    expect(save(eventId, { ...entryProfileFormValues(getEvent(eventId)) })).toBeUndefined();
  });
});

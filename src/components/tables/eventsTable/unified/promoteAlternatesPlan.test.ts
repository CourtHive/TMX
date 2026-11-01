import { entryStatusConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  buildPromoteAlternatesMethod,
  alternatesToPromote,
  orderedAlternateIds,
  clampPromoteCount,
  getPromotionPlan,
  openSlotsMessage,
  getEntrySpace,
} from './promoteAlternatesPlan';

// constants
import { PROMOTE_ALTERNATES } from 'constants/mutationConstants';

const { ALTERNATE, DIRECT_ACCEPTANCE, WITHDRAWN } = entryStatusConstants;

// an event of `accepted` entries plus `alternates` alternates, no draw
function seedEvent({ accepted = 6, alternates = 3 } = {}) {
  const {
    eventIds: [eventId],
  } = mocksEngine.generateTournamentRecord({
    eventProfiles: [{ participantsProfile: { participantsCount: accepted } }],
    participantsProfile: { participantsCount: accepted + alternates },
    setState: true,
  });
  const entered = tournamentEngine.getEvent({ eventId }).event.entries.map(({ participantId }) => participantId);
  const { participants = [] } = tournamentEngine.getParticipants();
  const alternateIds = participants
    .map(({ participantId }) => participantId)
    .filter((participantId) => !entered.includes(participantId))
    .slice(0, alternates);
  if (alternates) {
    const result: any = tournamentEngine.addEventEntries({
      eventId,
      participantIds: alternateIds,
      entryStatus: ALTERNATE,
    });
    expect(result.success).toEqual(true);
  }
  return { eventId, alternateIds, acceptedIds: entered };
}

const getEvent = (eventId: string) => tournamentEngine.getEvent({ eventId }).event;
// No factory mutation writes `entryProfile`; it arrives with an imported record. Round-trip the record to set it.
const setEntryProfile = (eventId: string, entryProfile: any) => {
  const { tournamentRecord } = tournamentEngine.getTournament();
  const event = tournamentRecord.events.find((e: any) => e.eventId === eventId);
  event.entryProfile = entryProfile;
  const result: any = tournamentEngine.setState(tournamentRecord);
  expect(result.success).toEqual(true);
};

describe('getPromotionPlan', () => {
  it('with no limit: no open-places figure, default 1, bounded by the alternates', () => {
    const { eventId, alternateIds } = seedEvent();
    const plan = getPromotionPlan({ event: getEvent(eventId) });
    expect(plan).toMatchObject({ acceptedCount: 6, openSlots: undefined, defaultCount: 1, min: 1, max: 3 });
    expect(plan.limit).toBeUndefined();
    expect(plan.alternateIds).toEqual(alternateIds);
  });

  it('counts open places against entriesLimit, and a withdrawal frees one', () => {
    const { eventId, acceptedIds } = seedEvent();
    setEntryProfile(eventId, { entriesLimit: 8 });
    let plan = getPromotionPlan({ event: getEvent(eventId) });
    expect(plan).toMatchObject({ limit: 8, limitSource: 'entriesLimit', acceptedCount: 6, openSlots: 2 });
    expect(plan.defaultCount).toEqual(2);

    const result: any = tournamentEngine.modifyEntriesStatus({
      participantIds: [acceptedIds[0]],
      entryStatus: WITHDRAWN,
      eventId,
    });
    expect(result.success).toEqual(true);
    plan = getPromotionPlan({ event: getEvent(eventId) });
    expect(plan).toMatchObject({ acceptedCount: 5, openSlots: 3, defaultCount: 3 });
  });

  it('falls back to targetDrawSize, and caps the default at the alternates count', () => {
    const { eventId } = seedEvent({ accepted: 4, alternates: 2 });
    setEntryProfile(eventId, { targetDrawSize: 16 });
    const plan = getPromotionPlan({ event: getEvent(eventId) });
    expect(plan).toMatchObject({ limit: 16, limitSource: 'targetDrawSize', openSlots: 12, defaultCount: 2, max: 2 });
  });

  it('a full field still defaults to 1 and reports no open places', () => {
    const { eventId } = seedEvent();
    setEntryProfile(eventId, { entriesLimit: 6 });
    const plan = getPromotionPlan({ event: getEvent(eventId) });
    expect(plan).toMatchObject({ openSlots: 0, defaultCount: 1, min: 1 });
  });

  it('with no alternates: nothing to promote', () => {
    const { eventId } = seedEvent({ alternates: 0 });
    const plan = getPromotionPlan({ event: getEvent(eventId) });
    expect(plan).toMatchObject({ alternateIds: [], min: 0, max: 0, defaultCount: 0 });
  });
});

describe('ordering and bounds', () => {
  it('orders by entryPosition, then the order entered', () => {
    const entries = [
      { participantId: 'u1', entryStatus: ALTERNATE },
      { participantId: 'p2', entryStatus: ALTERNATE, entryPosition: 2 },
      { participantId: 'a', entryStatus: DIRECT_ACCEPTANCE, entryPosition: 1 },
      { participantId: 'p1', entryStatus: ALTERNATE, entryPosition: 1 },
      { participantId: 'u2', entryStatus: ALTERNATE },
      { participantId: 'q', entryStatus: ALTERNATE, entryStage: 'QUALIFYING', entryPosition: 1 },
    ];
    expect(orderedAlternateIds(entries)).toEqual(['p1', 'p2', 'u1', 'u2']);
  });

  it('clamps the count to whole numbers within the bounds', () => {
    const bounds = { min: 1, max: 3 };
    expect(clampPromoteCount(0, bounds)).toEqual(1);
    expect(clampPromoteCount(9, bounds)).toEqual(3);
    expect(clampPromoteCount('2', bounds)).toEqual(2);
    expect(clampPromoteCount(2.7, bounds)).toEqual(2);
    expect(clampPromoteCount('', bounds)).toEqual(1);
    expect(clampPromoteCount('x', bounds)).toEqual(1);
  });
});

describe('promoting through the engine', () => {
  it('promotes the chosen number of alternates, in order, and leaves the rest', () => {
    const { eventId, alternateIds } = seedEvent();
    setEntryProfile(eventId, { entriesLimit: 8 });
    const plan = getPromotionPlan({ event: getEvent(eventId) });
    const participantIds = alternatesToPromote(plan, plan.defaultCount);
    expect(participantIds).toEqual(alternateIds.slice(0, 2));

    const method = buildPromoteAlternatesMethod({ eventId, participantIds });
    expect(method).toEqual({ method: PROMOTE_ALTERNATES, params: { eventId, participantIds } });
    const result: any = tournamentEngine.executionQueue([method]);
    expect(result.success).toEqual(true);

    const statusOf = (id: string) => getEvent(eventId).entries.find((e: any) => e.participantId === id).entryStatus;
    expect(participantIds.map(statusOf)).toEqual([DIRECT_ACCEPTANCE, DIRECT_ACCEPTANCE]);
    expect(statusOf(alternateIds[2])).toEqual(ALTERNATE);

    const after = getPromotionPlan({ event: getEvent(eventId) });
    expect(after).toMatchObject({ acceptedCount: 8, openSlots: 0, alternateIds: [alternateIds[2]] });
  });

  it('carries the drawId when the view has one', () => {
    expect(buildPromoteAlternatesMethod({ eventId: 'e', drawId: 'd', participantIds: ['p'] }).params).toEqual({
      eventId: 'e',
      drawId: 'd',
      participantIds: ['p'],
    });
  });
});

// the director's way to set the profile: modifyEvent, which validates and merges it
const modifyEntryProfile = (eventId: string, entryProfile: any) => {
  const result: any = tournamentEngine.modifyEvent({ eventId, eventUpdates: { entryProfile } });
  expect(result.success).toEqual(true);
};

describe('open places from getEventEntrySpace', () => {
  it('holds back the places for qualifiers and wildcards', () => {
    const { eventId } = seedEvent();
    modifyEntryProfile(eventId, { targetDrawSize: 16, qualifyingDrawSize: 8, qualifiersCount: 4, wildcardCount: 2 });
    const plan = getPromotionPlan({ event: getEvent(eventId) });
    expect(plan).toMatchObject({
      limitSource: 'targetDrawSize',
      drawPositions: 16,
      qualifierPositions: 4,
      wildcardPositions: 2,
      limit: 10,
      acceptedCount: 6,
      openSlots: 4,
      defaultCount: 3,
    });
    expect(openSlotsMessage(plan)).toEqual({
      key: 'entries.promoteAlternates.openSlotsHeld',
      values: { limit: 10, accepted: 6, open: 4, drawPositions: 16, qualifiers: 4, wildcards: 2 },
    });
  });

  it('the draw size wins over entriesLimit, which only counts when no draw size is stated', () => {
    const { eventId } = seedEvent();
    modifyEntryProfile(eventId, { entriesLimit: 8, targetDrawSize: 12 });
    const plan = getPromotionPlan({ event: getEvent(eventId) });
    expect(plan).toMatchObject({ limit: 12, limitSource: 'targetDrawSize', openSlots: 6 });
    expect(openSlotsMessage(plan)).toEqual({
      key: 'entries.promoteAlternates.openSlotsTargetDrawSize',
      values: { limit: 12, accepted: 6, open: 6 },
    });
  });

  it('counts against the sanctioned draw size when the event states none', () => {
    const { eventId } = seedEvent();
    const event = getEvent(eventId);
    const result: any = tournamentEngine.addTournamentExtension({
      extension: { name: 'sanctioningConstraints', value: { events: [{ eventType: event.eventType, drawSize: 8 }] } },
    });
    expect(result.success).toEqual(true);
    const plan = getPromotionPlan({ event });
    expect(plan).toMatchObject({ limit: 8, limitSource: 'sanctionedDrawSize', openSlots: 2 });
    expect(openSlotsMessage(plan).key).toEqual('entries.promoteAlternates.openSlotsSanctionedDrawSize');
  });

  it('uses a passed entrySpace as given, e.g. a generated draw', () => {
    const { eventId } = seedEvent();
    const entrySpace = {
      basis: 'STRUCTURE' as const,
      drawPositions: 8,
      qualifierPositions: 0,
      wildcardPositions: 0,
      directAcceptedCount: 6,
      directAcceptancePlaces: 8,
      openPlaces: 2,
    };
    const plan = getPromotionPlan({ event: getEvent(eventId), entrySpace });
    expect(plan).toMatchObject({ limit: 8, limitSource: 'drawPositions', openSlots: 2, defaultCount: 2 });
    expect(openSlotsMessage(plan)).toEqual({
      key: 'entries.promoteAlternates.openSlotsDrawPositions',
      values: { limit: 8, accepted: 6, open: 2 },
    });
  });

  it('explains entriesLimit and no limit', () => {
    const { eventId } = seedEvent();
    expect(openSlotsMessage(getPromotionPlan({ event: getEvent(eventId) }))).toEqual({
      key: 'entries.promoteAlternates.noLimit',
    });
    modifyEntryProfile(eventId, { entriesLimit: 8 });
    expect(openSlotsMessage(getPromotionPlan({ event: getEvent(eventId) })).key).toEqual(
      'entries.promoteAlternates.openSlotsEntriesLimit',
    );
  });

  it('asks the engine only for an event it holds', () => {
    expect(getEntrySpace(undefined)).toBeUndefined();
    expect(getEntrySpace({ eventId: 'unknown' })).toBeUndefined();
  });
});

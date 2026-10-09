/**
 * Structure-level publishing, round-tripped through the real factory.
 *
 * The UI writes `drawDetails[drawId].structureDetails` via PUBLISH_EVENT; these tests capture exactly the
 * method TMX sends, execute it on a real tournament, and read back what the PUBLIC sees through
 * `getEventData({ usePublishState: true })`. The load-bearing cases are the qualifying-first publish and
 * that a later structure-level write never hides a structure it did not mention.
 */
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { sent } = vi.hoisted(() => ({ sent: [] as any[] }));

vi.mock('services/mutation/mutationRequest', () => ({
  mutationRequest: ({ methods }: any) => {
    sent.push(...methods);
    for (const { method, params } of methods) {
      const result = (tournamentEngine as any)[method](params);
      if (result?.error) throw new Error(JSON.stringify(result.error));
    }
  },
}));
vi.mock('./renderPublishingTab', () => ({ renderPublishingTab: () => undefined }));
vi.mock('i18n', () => ({ t: (k: string) => k }));

import { getPublishingTableData } from './publishingData';
import {
  publishStructureDetails,
  setRoundScheduleEmbargo,
  setStructureRoundLimit,
  toggleStructurePublished,
} from './structurePublishing';

const QUALIFYING = 'QUALIFYING';
const MAIN = 'MAIN';

function setup() {
  const {
    drawIds: [drawId],
    eventIds: [eventId],
  } = mocksEngine.generateTournamentRecord({
    setState: true,
    drawProfiles: [
      {
        drawSize: 16,
        qualifyingProfiles: [{ structureProfiles: [{ drawSize: 16, qualifyingPositions: 4 }] }],
      },
    ],
  });
  const { drawDefinition } = tournamentEngine.getEvent({ drawId });
  const structureIdOf = (stage: string) => drawDefinition.structures.find((s: any) => s.stage === stage).structureId;
  return { eventId, drawId, qualifyingId: structureIdOf(QUALIFYING), mainId: structureIdOf(MAIN) };
}

function publicStages(eventId: string): string[] {
  const { eventData } = tournamentEngine.getEventData({ eventId, usePublishState: true });
  return (eventData?.drawsData ?? []).flatMap((draw: any) => (draw.structures ?? []).map((s: any) => s.stage));
}

afterEach(() => {
  sent.length = 0;
});

describe('structure-level publishing', () => {
  it('publishes ONLY the qualifying structure of an unpublished draw', () => {
    const { eventId, drawId, qualifyingId } = setup();
    expect(publicStages(eventId)).toEqual([]);

    toggleStructurePublished({
      structureId: qualifyingId,
      structurePublished: false,
      drawPublished: false,
      eventId,
      drawId,
    });

    expect(publicStages(eventId)).toEqual([QUALIFYING]);
  });

  it('sends a detail for EVERY structure, so none is hidden by omission', () => {
    const { eventId, drawId, qualifyingId, mainId } = setup();
    toggleStructurePublished({
      eventId,
      drawId,
      structureId: qualifyingId,
      structurePublished: false,
      drawPublished: false,
    });

    const structureDetails = sent[0].params.drawDetails[drawId].structureDetails;
    expect(Object.keys(structureDetails).sort((a, b) => a.localeCompare(b))).toEqual(
      [qualifyingId, mainId].sort((a, b) => a.localeCompare(b)),
    );
    expect(structureDetails[mainId].published).toBe(false);
  });

  it('then publishes MAIN alongside qualifying when toggled on', () => {
    const { eventId, drawId, qualifyingId, mainId } = setup();
    toggleStructurePublished({
      eventId,
      drawId,
      structureId: qualifyingId,
      structurePublished: false,
      drawPublished: false,
    });
    toggleStructurePublished({ eventId, drawId, structureId: mainId, structurePublished: false, drawPublished: true });

    expect(publicStages(eventId).sort((a, b) => a.localeCompare(b))).toEqual([MAIN, QUALIFYING]);
  });

  it('withholds an embargoed MAIN while qualifying is live', () => {
    const { eventId, drawId, qualifyingId, mainId } = setup();
    const embargo = new Date(Date.now() + 86_400_000).toISOString();
    toggleStructurePublished({
      eventId,
      drawId,
      structureId: qualifyingId,
      structurePublished: false,
      drawPublished: false,
    });
    publishStructureDetails({
      eventId,
      drawId,
      update: (structureId, detail) => (structureId === mainId ? { ...detail, published: true, embargo } : detail),
    });

    expect(publicStages(eventId)).toEqual([QUALIFYING]);

    const drawRow = getPublishingTableData()[0]._children?.[0];
    const mainRow = drawRow?._children?.find((row) => row.structureId === mainId);
    expect(mainRow?.publishState).toBe('embargoed');
    expect(drawRow?.expanded).toBe(true);
  });

  it('keeps the draw embargo when a structure is toggled', () => {
    const { eventId, drawId, mainId } = setup();
    const embargo = new Date(Date.now() + 86_400_000).toISOString();
    tournamentEngine.publishEvent({
      eventId,
      drawDetails: { [drawId]: { publishingDetail: { published: true, embargo } } },
    });

    toggleStructurePublished({ eventId, drawId, structureId: mainId, structurePublished: true, drawPublished: true });

    const drawRow = getPublishingTableData()[0]._children?.[0];
    expect(drawRow?.embargo).toBe(embargo);
  });

  it('lists structures collapsed when the draw is published whole', () => {
    const { eventId } = setup();
    tournamentEngine.publishEvent({ eventId });

    const drawRow = getPublishingTableData()[0]._children?.[0];
    expect(drawRow?._children?.map((row) => row.type)).toEqual(['structure', 'structure']);
    expect(drawRow?._children?.every((row) => row.publishState === 'live')).toBe(true);
    expect(drawRow?.expanded).toBe(false);
  });
});

/**
 * The draw view's round menu (handleRoundVisibilityClick) wrote a ONE-structure map, so embargoing a
 * qualifying round's schedule hid MAIN from the public. It now goes through these helpers.
 */
describe('round-level writes keep sibling structures', () => {
  const drawDetailOf = (eventId: string, drawId: string) =>
    tournamentEngine.getPublishState({ eventId }).publishState.status.drawDetails[drawId];

  it('a qualifying round schedule embargo leaves MAIN public', () => {
    const { eventId, drawId, qualifyingId } = setup();
    tournamentEngine.publishEvent({ eventId });
    // control: both structures are public before the write
    expect(publicStages(eventId).toSorted((a, b) => a.localeCompare(b))).toEqual([MAIN, QUALIFYING]);

    const embargo = new Date(Date.now() + 86_400_000).toISOString();
    setRoundScheduleEmbargo({
      eventId,
      drawId,
      structureId: qualifyingId,
      roundNumber: 1,
      embargo,
      callback: () => {},
    });

    expect(publicStages(eventId).toSorted((a, b) => a.localeCompare(b))).toEqual([MAIN, QUALIFYING]);
    expect(drawDetailOf(eventId, drawId).structureDetails[qualifyingId].scheduledRounds[1].embargo).toBe(embargo);

    setRoundScheduleEmbargo({ eventId, drawId, structureId: qualifyingId, roundNumber: 1, callback: () => {} });
    expect(drawDetailOf(eventId, drawId).structureDetails[qualifyingId].scheduledRounds[1]).toEqual({
      published: true,
    });
  });

  it('a round limit leaves MAIN public and is removed again', () => {
    const { eventId, drawId, qualifyingId } = setup();
    tournamentEngine.publishEvent({ eventId });

    setStructureRoundLimit({ eventId, drawId, structureId: qualifyingId, roundLimit: 1, callback: () => {} });
    expect(publicStages(eventId).toSorted((a, b) => a.localeCompare(b))).toEqual([MAIN, QUALIFYING]);
    expect(drawDetailOf(eventId, drawId).structureDetails[qualifyingId].roundLimit).toBe(1);

    setStructureRoundLimit({ eventId, drawId, structureId: qualifyingId, callback: () => {} });
    expect(drawDetailOf(eventId, drawId).structureDetails[qualifyingId].roundLimit).toBeUndefined();
  });
});

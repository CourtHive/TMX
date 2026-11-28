import { applyTopologyDrawSettings, topologyDrawSettings } from './topologyDrawSettings';
import { defined } from 'functions/testing/defined';
import { resolveTieFormat, tieFormatConstants } from '@courthive/competition-catalogue';
import { drawDefinitionConstants, mocksEngine } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { beforeAll, describe, expect, it } from 'vitest';

// constants
import { AUTOMATED, DRAFT } from 'constants/tmxConstants';

const { AD_HOC, SINGLE_ELIMINATION } = drawDefinitionConstants;
const main = { drawType: SINGLE_ELIMINATION, drawSize: 32, entriesCount: 32 };
let eventId: string;

beforeAll(() => {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({
    eventProfiles: [{ participantsProfile: { participantsCount: 32 } }],
  });
  tournamentEngine.setState(tournamentRecord);
  eventId = defined(tournamentRecord.events)[0].eventId;
});

describe('topologyDrawSettings', () => {
  it('reads the creation method as the Add Draw drawer does', () => {
    expect(topologyDrawSettings({ values: { creation: AUTOMATED }, eventId, main })).toMatchObject({
      automated: true,
      isDraft: false,
    });
    expect(topologyDrawSettings({ values: { creation: DRAFT }, eventId, main })).toMatchObject({
      automated: { seedsOnly: true },
      isDraft: true,
    });
    // Manual's option value is `false`, which a <select> reads back as the string
    expect(topologyDrawSettings({ values: { creation: 'false' }, eventId, main }).automated).toBe(false);
  });

  it('sends a chosen positioning preset as the seeding policy', () => {
    const settings = topologyDrawSettings({ values: { creation: AUTOMATED, seedingPolicy: 'CLUSTER' }, eventId, main });
    expect(settings.policyDefinitions.seeding.seedingProfile.positioning).toBe('CLUSTER');
  });

  it('lifts the policy limits only for a seed count above the policy ceiling', () => {
    const within = topologyDrawSettings({
      values: { creation: AUTOMATED, seedingPolicy: 'SEPARATE', seedsCount: '8' },
      eventId,
      main,
    });
    expect(within).toMatchObject({ seedsCount: 8 });
    expect(within.enforcePolicyLimits).toBeUndefined();

    const above = topologyDrawSettings({
      values: { creation: AUTOMATED, seedingPolicy: 'SEPARATE', seedsCount: '16' },
      eventId,
      main,
    });
    expect(above).toMatchObject({ seedsCount: 16, enforcePolicyLimits: false });
  });

  // The factory finds seeding values under seedingScaleName, else the event's category name, else its eventId; TMX
  // saves them under the eventId. Without the name a categorised event's draw had seed slots and nobody in them.
  it("seeds from the event's seeding values, as the Add Draw drawer does, even for an event with a category", () => {
    const settings = topologyDrawSettings({ values: { creation: AUTOMATED, seedsCount: '8' }, eventId, main });
    expect(settings.seedingScaleName).toBe(eventId);

    const record = defined(tournamentEngine.getTournament().tournamentRecord, 'tournamentRecord');
    defined(record.events, 'events')[0].category = { categoryName: '18U' };
    tournamentEngine.setState(record);
    const event = defined(tournamentEngine.getEvent({ eventId }).event);
    expect(event.category?.categoryName).toBe('18U');
    const seeded = defined(event.entries)
      .slice(0, 8)
      .map((entry: any) => entry.participantId);
    tournamentEngine.setParticipantScaleItems({
      scaleItemsWithParticipantIds: seeded.map((participantId: string, i: number) => ({
        participantId,
        scaleItems: [{ scaleType: 'SEEDING', eventType: 'SINGLES', scaleName: eventId, scaleValue: i + 1 }],
      })),
    });
    const generate = (drawOptions: any): any[] => {
      const result: any = tournamentEngine.generateDrawDefinition({ eventId, ...drawOptions });
      return result.drawDefinition.structures[0].seedAssignments;
    };
    const options = { drawType: SINGLE_ELIMINATION, drawSize: 32, automated: true };

    const withScale = generate(applyTopologyDrawSettings(options, settings));
    expect(withScale.map((assignment: any) => assignment.participantId)).toEqual(seeded);
    // without it the factory looks under '18U': the slots are there and empty
    const { seedingScaleName: _omitted, ...without } = settings;
    expect(generate(applyTopologyDrawSettings(options, without)).every((a: any) => !a.participantId)).toBe(true);
  });

  it('asks for no seed count for a Main that cannot be seeded', () => {
    const settings = topologyDrawSettings({
      values: { creation: AUTOMATED, seedsCount: '8' },
      eventId,
      main: { ...main, drawType: AD_HOC },
    });
    expect(settings.seedsCount).toBeUndefined();
  });

  it('leaves a custom score format and scorecard to their editors', () => {
    const settings = topologyDrawSettings({
      values: { creation: AUTOMATED, matchUpFormat: 'CUSTOM', tieFormatName: 'CUSTOM' },
      eventId,
      main,
    });
    expect(settings.matchUpFormat).toBeUndefined();
    expect(settings.tieFormat).toBeUndefined();
  });

  it('passes a named scorecard as its tieFormat object, never as a name', () => {
    const settings = topologyDrawSettings({
      values: { creation: AUTOMATED, tieFormatName: tieFormatConstants.DOMINANT_DUO },
      eventId,
      main,
    });
    expect(settings).not.toHaveProperty('tieFormatName');
    expect(settings.tieFormat).toEqual(resolveTieFormat(tieFormatConstants.DOMINANT_DUO));
    expect(settings.tieFormat?.collectionDefinitions?.length).toBeGreaterThan(0);
  });
});

describe('applyTopologyDrawSettings', () => {
  const settings = {
    automated: false,
    isDraft: false,
    matchUpFormat: 'SET1-S:6/TB7',
    policyDefinitions: { seeding: { policyName: 'chosen' } },
  };

  it('replaces the topology default positioning and adds what the topology does not define', () => {
    const drawOptions = { drawType: SINGLE_ELIMINATION, drawSize: 32, automated: true, matchUpFormat: undefined };
    expect(applyTopologyDrawSettings(drawOptions, settings)).toMatchObject({
      drawSize: 32,
      automated: false,
      matchUpFormat: 'SET1-S:6/TB7',
      policyDefinitions: { seeding: { policyName: 'chosen' } },
    });
  });

  it('keeps the score format the Main card set', () => {
    const drawOptions = { drawType: SINGLE_ELIMINATION, drawSize: 32, matchUpFormat: 'SET3-S:4/TB7' };
    expect(applyTopologyDrawSettings(drawOptions, settings).matchUpFormat).toBe('SET3-S:4/TB7');
  });
});

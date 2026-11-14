import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashCode } from 'functions/hashCode';

vi.mock('services/factory/engine', async () => ({
  tournamentEngine: (await import('tods-competition-factory')).tournamentEngine,
}));
vi.mock('services/mutation/mutationRequest', () => ({
  mutationRequest: ({ methods, callback }: any) => callback(tournamentEngine.executionQueue(methods)),
}));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

import { commitParticipantImport, previewParticipantImport } from './commitParticipantImport';

const mapping: any = {
  0: { kind: 'participantId' },
  1: { kind: 'firstName' },
  2: { kind: 'lastName' },
  3: { kind: 'eventEntry', eventId: 'event' },
};
const rows = [['row-one', 'Ana', 'Rivas', 'yes']];
const args = { headers: [], rows, mapping, dedupeKey: 'participantId' as const };

describe('participant import after consolidation', () => {
  afterEach(() => tournamentEngine.reset());

  it('resolves a retired import id for preview, updates and event entries', async () => {
    const retired = `XXX-${hashCode('row-one')}`;
    const { tournamentRecord } = mocksEngine.generateTournamentRecord({ setState: true });
    tournamentRecord.participants = [
      {
        participantId: 'retained',
        participantType: 'INDIVIDUAL',
        participantRole: 'COMPETITOR',
        participantName: 'Ana Rivas',
        person: {
          personId: '00000000-0000-4000-8000-000000000001',
          standardGivenName: 'Ana',
          standardFamilyName: 'Rivas',
        },
      },
    ];
    tournamentRecord.extensions = [
      { name: 'individualParticipantMerges', value: { version: 1, aliases: { [retired]: 'retained' } } },
    ];
    tournamentRecord.events = [{ eventId: 'event', eventName: 'Open', eventType: 'SINGLES' }];
    tournamentEngine.setState(tournamentRecord);
    const preview = previewParticipantImport(args);
    expect(preview.resolved[0].status).toBe('redirected');
    expect(preview.resolved[0].participant.participantId).toBe('retained');
    expect(preview.participants).toHaveLength(0);
    let result: any = await new Promise((resolve) => commitParticipantImport({ ...args, callback: resolve }));
    expect(result.success).toBe(true);
    expect(result.addedCount).toBe(0);
    expect(tournamentEngine.getParticipants().participants).toHaveLength(1);
    expect(tournamentEngine.getEvent({ eventId: 'event' }).event?.entries?.[0].participantId).toBe('retained');
    const updates = previewParticipantImport({ ...args, updateExisting: true });
    expect(updates.updates[0].participantId).toBe('retained');
  });

  it('uses the same generated id for explicit-id preview and commit', () => {
    mocksEngine.generateTournamentRecord({ setState: true });
    const preview = previewParticipantImport(args);
    expect(preview.resolved[0].participant.participantId).toBe(`XXX-${hashCode('row-one')}`);
    expect(preview.resolved[0].status).toBe('new');
  });
});

it('re-creates a deleted survivor rather than the retired duplicate', async () => {
  const retired = `XXX-${hashCode('row-one')}`;
  const SURVIVOR = 'deleted-survivor';
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({ setState: true });
  tournamentRecord.extensions = [
    { name: 'individualParticipantMerges', value: { version: 1, aliases: { [retired]: SURVIVOR } } },
  ];
  tournamentRecord.participants = [];
  tournamentRecord.events = [{ eventId: 'event', eventName: 'Open', eventType: 'SINGLES' }];
  tournamentEngine.setState(tournamentRecord);
  const preview = previewParticipantImport(args);
  expect(preview.resolved[0].status).toBe('redirected');
  expect(preview.resolved[0].participant.participantId).toBe(SURVIVOR);
  const result: any = await new Promise((resolve) => commitParticipantImport({ ...args, callback: resolve }));
  expect(result.success).toBe(true);
  const ids = tournamentEngine.getParticipants().participants?.map((p: any) => p.participantId);
  expect(ids).toEqual([SURVIVOR]);
  expect(tournamentEngine.getEvent({ eventId: 'event' }).event?.entries?.[0].participantId).toBe(SURVIVOR);
});

it('does not create an invalid participant when alias resolution fails', async () => {
  const retired = `XXX-${hashCode('row-one')}`;
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({ setState: true });
  // A cyclic ledger cannot resolve; a merely missing survivor can (it was deleted after the merge).
  tournamentRecord.extensions = [
    { name: 'individualParticipantMerges', value: { version: 1, aliases: { [retired]: 'loop', loop: retired } } },
  ];
  tournamentRecord.participants = [];
  tournamentEngine.setState(tournamentRecord);
  const preview = previewParticipantImport(args);
  expect(preview.participants).toHaveLength(0);
  expect(preview.resolved[0].status).toBe('invalid');
  let result: any = await new Promise((resolve) =>
    commitParticipantImport({ ...args, rows: [...rows, ['new-row', 'New', 'Person', '']], callback: resolve }),
  );
  expect(result.success).toBe(false);
  expect(tournamentEngine.getParticipants().participants).toHaveLength(0);
});

import { describeBulkRow, precheckBulkMatchUpStatus, type BulkStatusRow } from './bulkMatchUpStatus';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it, vi } from 'vitest';

// The real engine: every answer below is the factory's, through the same module TMX calls.
vi.mock('services/factory/engine', async () => ({
  tournamentEngine: (await import('tods-competition-factory')).tournamentEngine,
}));

const completed = (winningSide: number) => ({
  matchUpStatus: 'COMPLETED',
  winningSide,
  score: {
    sets: [1, 2].map((setNumber) => ({
      setNumber,
      side1Score: winningSide === 1 ? 6 : 1,
      side2Score: winningSide === 2 ? 6 : 1,
      winningSide,
    })),
  },
});

function setup() {
  const {
    drawIds: [drawId],
    eventIds: [eventId],
  } = mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 8 }], setState: true, nonRandom: 1 } as any);
  const round = (roundNumber: number): any[] =>
    tournamentEngine.allDrawMatchUps({ drawId, inContext: true, matchUpFilters: { roundNumbers: [roundNumber] } })
      .matchUps ?? [];
  const row = (matchUp: any): BulkStatusRow => ({ matchUpId: matchUp.matchUpId, drawId, eventId, matchUp });
  const score = (matchUpId: string, winningSide: number) => {
    const result: any = tournamentEngine.setMatchUpStatus({ drawId, matchUpId, outcome: completed(winningSide) });
    expect(result.success).toEqual(true);
  };
  const find = (matchUpId: string) => tournamentEngine.findMatchUp({ drawId, matchUpId, inContext: true }).matchUp;
  return { drawId, eventId, round, row, score, find };
}

const recordNow = () => structuredClone(tournamentEngine.getTournament().tournamentRecord);

describe('precheckBulkMatchUpStatus', () => {
  it('refuses the whole batch when one row would be refused, names that row, and writes nothing', () => {
    const { round, row, score } = setup();
    const [first, second, third] = round(1);
    // `first` is decided and its winner has played round 2: matchUpActions still offers SCORE on it, but the mutation
    // refuses a status change under an active downstream. Only the dry run can know that.
    score(first.matchUpId, 1);
    score(second.matchUpId, 1);
    score(round(2)[0].matchUpId, 1);
    const before = recordNow();

    const precheck = precheckBulkMatchUpStatus({ matchUpStatus: 'ABANDONED', rows: [row(third), row(first)] });

    expect(precheck.methods).toBeUndefined();
    expect(precheck.refusals).toHaveLength(1);
    expect(precheck.refusals[0].row.matchUpId).toEqual(first.matchUpId);
    expect(precheck.refusals[0].reason).toEqual('refused');
    expect(precheck.refusals[0].message).toBeTruthy();
    expect(recordNow()).toEqual(before);
    expect(tournamentEngine.findMatchUp({ matchUpId: third.matchUpId }).matchUp?.matchUpStatus).toEqual('TO_BE_PLAYED');
  });

  it('reports every refused row, including one matchUpActions does not offer scoring on', () => {
    const { round, row, score } = setup();
    const [first, second, third] = round(1);
    score(first.matchUpId, 1);
    score(second.matchUpId, 1);
    score(round(2)[0].matchUpId, 1);
    const waiting = round(2)[1]; // no participants yet: no SCORE action

    const precheck = precheckBulkMatchUpStatus({
      matchUpStatus: 'CANCELLED',
      rows: [row(first), row(third), row(waiting)],
    });

    expect(precheck.methods).toBeUndefined();
    const byId = Object.fromEntries(precheck.refusals.map((refusal) => [refusal.row.matchUpId, refusal.reason]));
    expect(byId).toEqual({ [first.matchUpId]: 'refused', [waiting.matchUpId]: 'notScorable' });
  });

  it('a valid batch is sent as one bulkMatchUpStatusUpdate and applied through executionQueue', () => {
    const { round, row, find } = setup();
    const rows = round(1).slice(0, 3).map(row);

    const precheck = precheckBulkMatchUpStatus({ matchUpStatus: 'ABANDONED', rows });
    expect(precheck.refusals).toEqual([]);
    expect(precheck.methods).toHaveLength(1);
    expect(precheck.methods?.[0].method).toEqual('bulkMatchUpStatusUpdate');
    expect(precheck.methods?.[0].params.outcomes.map((outcome) => outcome.matchUpId)).toEqual(
      rows.map(({ matchUpId }) => matchUpId),
    );

    const result: any = tournamentEngine.executionQueue(precheck.methods as any);
    expect(result.success).toEqual(true);
    expect(rows.map(({ matchUpId }) => find(matchUpId)?.matchUpStatus)).toEqual([
      'ABANDONED',
      'ABANDONED',
      'ABANDONED',
    ]);
    expect(find(round(1)[3].matchUpId)?.matchUpStatus).toEqual('TO_BE_PLAYED');
  });

  it('DOUBLE_WALKOVER propagates exactly as the same outcome entered singly does', () => {
    const { drawId, round, row, score, find } = setup();
    const [, , third, fourth] = round(1);
    score(fourth.matchUpId, 2);
    const snapshot = recordNow();
    const target = round(2)[1]; // fed by `third` and `fourth`

    const precheck = precheckBulkMatchUpStatus({ matchUpStatus: 'DOUBLE_WALKOVER', rows: [row(third)] });
    expect(precheck.refusals).toEqual([]);
    const bulk: any = tournamentEngine.executionQueue(precheck.methods as any);
    expect(bulk.success).toEqual(true);
    const shape = (matchUp: any) => ({
      matchUpStatus: matchUp?.matchUpStatus,
      winningSide: matchUp?.winningSide,
      participantIds: matchUp?.sides?.map((side: any) => side.participantId ?? null),
    });
    const afterBulk = { source: shape(find(third.matchUpId)), target: shape(find(target.matchUpId)) };

    tournamentEngine.setState(snapshot);
    const single: any = tournamentEngine.setMatchUpStatus({
      drawId,
      matchUpId: third.matchUpId,
      outcome: { matchUpStatus: 'DOUBLE_WALKOVER' },
    });
    expect(single.success).toEqual(true);
    const afterSingle = { source: shape(find(third.matchUpId)), target: shape(find(target.matchUpId)) };

    expect(afterBulk).toEqual(afterSingle);
    expect(afterBulk.source.matchUpStatus).toEqual('DOUBLE_WALKOVER');
    // the factory's decision, observed: the opponent from `fourth` takes round 2 by walkover
    expect(afterBulk.target.matchUpStatus).toEqual('WALKOVER');
    expect(afterBulk.target.participantIds).toContain(find(fourth.matchUpId)?.sides?.[1]?.participantId);
  });

  it('two DOUBLE_WALKOVERs feeding one matchUp are asked in batch order and land as entered one after the other', () => {
    const { drawId, round, row, score, find } = setup();
    const [, , third, fourth] = round(1);
    score(fourth.matchUpId, 2);
    const target = round(2)[1];
    const snapshot = recordNow();

    // `fourth` is decided; its DOUBLE_WALKOVER is asked against the record the one for `third` ahead of it leaves
    const precheck = precheckBulkMatchUpStatus({ matchUpStatus: 'DOUBLE_WALKOVER', rows: [row(third), row(fourth)] });
    expect(recordNow()).toEqual(snapshot);
    expect(precheck.refusals).toEqual([]);
    expect((tournamentEngine.executionQueue(precheck.methods as any) as any).success).toEqual(true);
    const afterBulk = find(target.matchUpId);

    tournamentEngine.setState(snapshot);
    for (const matchUpId of [third.matchUpId, fourth.matchUpId]) {
      const single: any = tournamentEngine.setMatchUpStatus({
        drawId,
        matchUpId,
        outcome: { matchUpStatus: 'DOUBLE_WALKOVER' },
      });
      expect(single.success).toEqual(true);
    }
    const afterSingle = find(target.matchUpId);
    expect(afterBulk?.matchUpStatus).toEqual(afterSingle?.matchUpStatus);
    expect(afterBulk?.winningSide).toEqual(afterSingle?.winningSide);
    // the factory's decision, observed: with neither side able to arrive, round 2 is a double walkover too
    expect(afterBulk?.matchUpStatus).toEqual('DOUBLE_WALKOVER');
  });

  it('refuses a status that is not a bulk status', () => {
    const { round, row } = setup();
    const precheck = precheckBulkMatchUpStatus({ matchUpStatus: 'COMPLETED', rows: [row(round(1)[0])] });
    expect(precheck.methods).toBeUndefined();
    expect(precheck.refusals.map(({ reason }) => reason)).toEqual(['statusDisabled']);
  });
});

describe('describeBulkRow', () => {
  it('names the event, round and both sides', () => {
    const row = {
      matchUpId: 'm',
      drawId: 'd',
      eventId: 'e',
      eventName: 'Boys 16',
      roundName: 'R16',
      side1: { participant: { participantName: 'Ann' } },
      side2: { participant: { participantName: 'Bea' } },
    };
    expect(describeBulkRow(row)).toEqual('Boys 16 R16: Ann / Bea');
    expect(describeBulkRow({ ...row, side2: undefined })).toEqual('Boys 16 R16: Ann');
  });
});

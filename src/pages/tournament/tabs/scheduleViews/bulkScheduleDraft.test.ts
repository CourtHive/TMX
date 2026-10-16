import { BulkScheduleDraft } from './bulkScheduleDraft';
import { describe, expect, it, vi } from 'vitest';

function fixture() {
  let state = {
    tournamentId: 't1',
    tournamentRecords: {
      t1: {
        tournamentName: 'Original',
        events: [{ eventId: 'e1', matchUps: [{ matchUpId: 'm1', schedule: { courtId: 'A' } }] }],
      },
      t2: { tournamentName: 'Linked' },
    },
  };
  const engine = {
    getState: () => structuredClone(state),
    setState: (records: any) => {
      state.tournamentRecords = records;
      return { success: true };
    },
    setTournamentId: (id: string) => {
      state.tournamentId = id;
    },
    executionQueue: () => {
      state.tournamentRecords.t1.events[0].matchUps[0].schedule.courtId = 'B';
      return { success: true };
    },
  };
  return { engine, read: () => state };
}

describe('bulk schedule recovery', () => {
  it('discards without IndexedDB while preserving concurrent primary and linked record edits', () => {
    const f = fixture();
    const draft = new BulkScheduleDraft();
    draft.stage([{ method: 'move' }], f.engine);
    f.read().tournamentRecords.t1.tournamentName = 'Remote edit';
    f.read().tournamentRecords.t2.tournamentName = 'Linked remote edit';
    expect(draft.discard(f.engine).success).toBe(true);
    expect(f.read().tournamentRecords.t1.events[0].matchUps[0].schedule.courtId).toBe('A');
    expect(f.read().tournamentRecords.t1.tournamentName).toBe('Remote edit');
    expect(f.read().tournamentRecords.t2.tournamentName).toBe('Linked remote edit');
  });
  it('keeps pending methods through failed and in-flight saves, and prevents duplicate submission', () => {
    const f = fixture();
    const draft = new BulkScheduleDraft();
    draft.stage([{ method: 'move' }], f.engine);
    let answer: any;
    const send = vi.fn((done) => {
      answer = done;
    });
    draft.save(draft.pending.flat(), send, () => {});
    draft.save(draft.pending.flat(), send, () => {});
    expect(send).toHaveBeenCalledTimes(1);
    expect(draft.pending).toHaveLength(1);
    expect(draft.discard(f.engine).error).toBeTruthy();
    answer({ error: 'refused' });
    expect(draft.pending).toHaveLength(1);
    draft.save(
      draft.pending.flat(),
      (done) => done({ success: true }),
      () => {},
    );
    expect(draft.pending).toHaveLength(0);
  });
  it('preserves a remote replacement of the same field rather than restoring an older court', () => {
    const f = fixture();
    const draft = new BulkScheduleDraft();
    draft.stage([{ method: 'move' }], f.engine);
    f.read().tournamentRecords.t1.events[0].matchUps[0].schedule.courtId = 'C';
    expect(draft.discard(f.engine).success).toBe(true);
    expect(f.read().tournamentRecords.t1.events[0].matchUps[0].schedule.courtId).toBe('C');
  });
  it('does not undo an authoritative reload that matches the old preview', () => {
    const f = fixture();
    const draft = new BulkScheduleDraft();
    let current = true;
    draft.stage([{ method: 'move' }], f.engine, () => current);
    current = false;
    expect(draft.discard(f.engine).success).toBe(true);
    expect(f.read().tournamentRecords.t1.events[0].matchUps[0].schedule.courtId).toBe('B');
    expect(draft.pending).toHaveLength(0);
  });
  it('refuses to submit intents captured before a full record replacement', () => {
    const f = fixture();
    const draft = new BulkScheduleDraft();
    let current = true;
    draft.stage([{ method: 'move' }], f.engine, () => current);
    current = false;
    const send = vi.fn();
    const complete = vi.fn();
    draft.save(draft.pending.flat(), send, complete);
    expect(send).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledWith({ error: expect.any(String) });
    expect(draft.pending).toHaveLength(1);
    expect(draft.saving).toBe(false);
  });
  it('removes only preview timeItems while preserving an appended call', () => {
    const f = fixture();
    const match: any = f.read().tournamentRecords.t1.events[0].matchUps[0];
    match.timeItems = [{ itemType: 'SCHEDULE.ASSIGNMENT.COURT', itemValue: 'old', createdAt: 'a' }];
    f.engine.executionQueue = () => {
      match.timeItems.push({ itemType: 'SCHEDULE.ASSIGNMENT.COURT', itemValue: 'preview', createdAt: 'b' });
      return { success: true };
    };
    const draft = new BulkScheduleDraft();
    draft.stage([{ method: 'schedule' }], f.engine);
    match.timeItems.push({ itemType: 'SCHEDULE.CALL', itemValue: 'called', createdAt: 'c' });
    expect(draft.discard(f.engine).success).toBe(true);
    const restored = (f.read().tournamentRecords.t1.events[0].matchUps[0] as any).timeItems;
    expect(restored.map((item: any) => item.itemValue)).toEqual(['old', 'called']);
  });
  it('restores an id-keyed object removed by the preview while retaining remote additions', () => {
    const f = fixture();
    const original = structuredClone(f.read().tournamentRecords.t1.events[0]);
    f.engine.executionQueue = () => {
      f.read().tournamentRecords.t1.events = [];
      return { success: true };
    };
    const draft = new BulkScheduleDraft();
    draft.stage([{ method: 'remove' }], f.engine);
    const remote = { eventId: 'e2', matchUps: [] };
    f.read().tournamentRecords.t1.events.push(remote);
    expect(draft.discard(f.engine).success).toBe(true);
    expect(f.read().tournamentRecords.t1.events).toEqual(expect.arrayContaining([original, remote]));
  });
});

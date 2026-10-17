import { setServerSync } from 'services/staleness/serverSync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifySaveResponse,
  durableSave,
  expectedServerUpdatedAtFor,
  forgetOfflineSyncPoint,
  offlineSyncPoint,
  rememberOfflineSyncPoint,
  resetDurableSaves,
} from './durableSave';

import type { SaveBody } from './durableSave';

// C3: durable, conditional whole-record saves (competition-factory-server COMMAND_RECEIPTS.md § Wholesale saves).
const TID = 'tournament-c3';
const W1 = '2026-10-17T10:00:00.000Z';
const W2 = '2026-10-17T10:05:00.000Z';

const ok = (extra: any = {}) => ({ status: 200, data: { success: true, serverUpdatedAt: { [TID]: W2 }, ...extra } });
const conflict = () => ({
  status: 409,
  data: {
    error: 'Tournament changed since it was read',
    conflict: true,
    tournamentId: TID,
    expectedServerUpdatedAt: W1,
    serverUpdatedAt: W2,
  },
});

function fakeStorage(): Storage {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
    clear: () => items.clear(),
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() {
      return items.size;
    },
  } as Storage;
}

/** A transport that answers from a script, recording every body it was sent. */
function scriptedSend(...answers: Array<any | (() => any)>) {
  const bodies: SaveBody[] = [];
  const send = vi.fn(async (body: SaveBody) => {
    bodies.push(structuredClone(body));
    const answer = answers.shift();
    return typeof answer === 'function' ? answer() : answer;
  });
  return { send, bodies };
}

const record = () => ({ tournamentId: TID, tournamentName: 'C3', parentOrganisation: { organisationId: 'p1' } });
const noWait = vi.fn(async () => undefined);

beforeEach(() => {
  resetDurableSaves();
  setServerSync(TID, undefined);
  noWait.mockClear();
  vi.stubGlobal('localStorage', fakeStorage());
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('durableSave — one commandId per action', () => {
  it('a lost answer is resent under the SAME commandId and the same body', async () => {
    const { send, bodies } = scriptedSend(undefined, ok());
    const result = await durableSave({ tournamentRecord: record(), flow: 'upload', send, wait: noWait });

    expect(result.status).toBe('saved');
    expect(result.attempts).toBe(2);
    expect(bodies).toHaveLength(2);
    expect(bodies[0].commandId).toMatch(/^[a-zA-Z0-9_-]{8,128}$/); // the server's accepted key shape
    expect(bodies[1].commandId).toBe(bodies[0].commandId);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(result.commandId).toBe(bodies[0].commandId);
    expect(noWait).toHaveBeenCalledWith(1000);
  });

  it('a transport error, a gateway error and a retryable 503 are all resent under the same key', async () => {
    const { send, bodies } = scriptedSend(
      () => {
        throw new Error('Network Error');
      },
      { status: 503, data: { message: 'Command could not be committed' } },
      ok(),
    );
    const result = await durableSave({ tournamentRecord: record(), flow: 'upload', send, wait: noWait });
    expect(result.status).toBe('saved');
    expect(new Set(bodies.map((b) => b.commandId)).size).toBe(1);
    expect(noWait.mock.calls).toEqual([[1000], [3000]]);
  });

  it('sends the snapshot taken before the first send, even if the record changes during retries', async () => {
    const tournamentRecord: any = record();
    const { send, bodies } = scriptedSend(() => {
      tournamentRecord.tournamentName = 'edited while the save was in flight';
      return undefined;
    }, ok());
    await durableSave({ tournamentRecord, flow: 'upload', send, wait: noWait });
    expect(bodies[1].tournamentRecord.tournamentName).toBe('C3');
  });

  it('two separate actions get two commandIds', async () => {
    const first = await durableSave({ tournamentRecord: record(), flow: 'upload', send: scriptedSend(ok()).send });
    const second = await durableSave({ tournamentRecord: record(), flow: 'upload', send: scriptedSend(ok()).send });
    expect(second.commandId).not.toBe(first.commandId);
  });
});

describe('durableSave — answers', () => {
  it('a deduplicated answer is a success: the first send landed', async () => {
    const { send } = scriptedSend(undefined, ok({ deduplicated: true, durableReceipt: true }));
    const result = await durableSave({ tournamentRecord: record(), flow: 'goOnline', send, wait: noWait });
    expect(result).toMatchObject({ status: 'saved', deduplicated: true, attempts: 2 });
  });

  it('a 409 conflict is reported with the server write, never resent, and the record is untouched', async () => {
    const tournamentRecord = record();
    const before = structuredClone(tournamentRecord);
    const { send } = scriptedSend(conflict());
    const result = await durableSave({ tournamentRecord, flow: 'goOnline', send, wait: noWait });

    expect(result).toMatchObject({
      status: 'conflict',
      tournamentId: TID,
      expectedServerUpdatedAt: W1,
      serverUpdatedAt: W2,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(tournamentRecord).toEqual(before);
  });

  it('a refusal is final: not resent', async () => {
    const { send } = scriptedSend({ status: 200, data: { error: 'User not allowed' } });
    const result = await durableSave({ tournamentRecord: record(), flow: 'upload', send, wait: noWait });
    expect(result).toMatchObject({ status: 'refused', httpStatus: 200 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('every send lost: uncertain; repeating the unchanged action reuses the key, a changed one does not', async () => {
    const lost = scriptedSend(undefined, undefined, undefined);
    const first = await durableSave({ tournamentRecord: record(), flow: 'upload', send: lost.send, wait: noWait });
    expect(first).toMatchObject({ status: 'uncertain', attempts: 3 });

    // The director tries again with nothing changed: the server can answer whether the first landed.
    const repeat = scriptedSend(ok({ deduplicated: true }));
    const second = await durableSave({ tournamentRecord: record(), flow: 'upload', send: repeat.send });
    expect(repeat.bodies[0].commandId).toBe(first.commandId);
    expect(second).toMatchObject({ status: 'saved', deduplicated: true });

    // Answered: the key is spent, and a further action is a new one.
    const after = await durableSave({ tournamentRecord: record(), flow: 'upload', send: scriptedSend(ok()).send });
    expect(after.commandId).not.toBe(first.commandId);

    // An uncertain save followed by a DIFFERENT body must not reuse the key (the server would refuse it).
    const lostAgain = await durableSave({
      tournamentRecord: record(),
      flow: 'upload',
      send: scriptedSend(undefined, undefined, undefined).send,
      wait: noWait,
    });
    const changed = scriptedSend(ok());
    await durableSave({
      tournamentRecord: { ...record(), tournamentName: 'changed' },
      flow: 'upload',
      send: changed.send,
    });
    expect(changed.bodies[0].commandId).not.toBe(lostAgain.commandId);
  });
});

describe('classifySaveResponse', () => {
  it.each([
    ['no response', undefined, 'uncertain'],
    ['401 after a failed refresh', { status: 401, data: {} }, 'uncertain'],
    ['gateway', { status: 504, data: {} }, 'uncertain'],
    ['server error', { status: 500, data: {} }, 'uncertain'],
    ['success', ok(), 'saved'],
    ['conflict', conflict(), 'conflict'],
    // The receipt's own 409: the key was reused for a different body. Not a newer server record.
    ['key reused', { status: 409, data: { message: 'Command ID reused for different intent' } }, 'refused'],
    ['validation', { status: 400, data: { error: 'failed validation', validationErrors: ['x'] } }, 'refused'],
  ])('%s → %s', (_label, response, status) => {
    expect(classifySaveResponse(response).status).toBe(status);
  });
});

describe('expectedServerUpdatedAt per flow', () => {
  it('create and claim: the tournament must not exist on the server yet', () => {
    setServerSync(TID, W1); // even a known sync point does not apply: these records were never there
    expect(expectedServerUpdatedAtFor('create', TID)).toEqual({ [TID]: null });
    expect(expectedServerUpdatedAtFor('claim', TID)).toEqual({ [TID]: null });
  });

  it('upload: conditional on the sync point when there is one, as confirmed when there is none', () => {
    expect(expectedServerUpdatedAtFor('upload', TID)).toBeUndefined();
    setServerSync(TID, W1);
    expect(expectedServerUpdatedAtFor('upload', TID)).toEqual({ [TID]: W1 });
  });

  it('upload ignores a remembered offline point: only a copy known current is conditional', () => {
    setServerSync(TID, W1);
    rememberOfflineSyncPoint(TID);
    setServerSync(TID, undefined);
    expect(expectedServerUpdatedAtFor('upload', TID)).toBeUndefined();
  });

  it('goOnline: the write it went offline at, surviving a reload that loses the sync point', () => {
    setServerSync(TID, W1);
    expect(expectedServerUpdatedAtFor('goOnline', TID)).toEqual({ [TID]: W1 });

    rememberOfflineSyncPoint(TID);
    setServerSync(TID, undefined); // the reload: an offline copy loads from IndexedDB with no sync point
    expect(offlineSyncPoint(TID)).toBe(W1);
    expect(expectedServerUpdatedAtFor('goOnline', TID)).toEqual({ [TID]: W1 });

    forgetOfflineSyncPoint(TID);
    expect(expectedServerUpdatedAtFor('goOnline', TID)).toBeUndefined();
  });

  it('going offline with no sync point clears any older remembered one', () => {
    setServerSync(TID, W1);
    rememberOfflineSyncPoint(TID);
    setServerSync(TID, undefined);
    rememberOfflineSyncPoint(TID);
    expect(offlineSyncPoint(TID)).toBeUndefined();
  });

  it('the precondition rides the body only when there is one', async () => {
    const claim = scriptedSend(ok());
    await durableSave({ tournamentRecord: record(), flow: 'claim', send: claim.send });
    expect(claim.bodies[0].expectedServerUpdatedAt).toEqual({ [TID]: null });

    const upload = scriptedSend(ok());
    await durableSave({ tournamentRecord: record(), flow: 'upload', send: upload.send });
    expect('expectedServerUpdatedAt' in upload.bodies[0]).toBe(false);

    setServerSync(TID, W1);
    const online = scriptedSend(ok());
    await durableSave({ tournamentRecord: record(), flow: 'goOnline', send: online.send });
    expect(online.bodies[0].expectedServerUpdatedAt).toEqual({ [TID]: W1 });
  });

  it('without localStorage the flows still work, unconditionally where nothing is known', () => {
    vi.stubGlobal('localStorage', undefined);
    rememberOfflineSyncPoint(TID);
    expect(offlineSyncPoint(TID)).toBeUndefined();
    expect(expectedServerUpdatedAtFor('goOnline', TID)).toBeUndefined();
  });
});

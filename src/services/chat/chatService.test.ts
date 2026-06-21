import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let uuidCounter = 0;
vi.mock('tods-competition-factory', () => ({
  tools: { UUID: () => `cid-${++uuidCounter}` },
}));

const tournamentRecord: any = {
  tournamentId: 't1',
  tournamentName: 'Open',
  parentOrganisation: { organisationId: 'prov-1', organisationAbbreviation: 'ACME' },
};
vi.mock('services/factory/engine', () => ({
  tournamentEngine: { getTournament: () => ({ tournamentRecord }) },
}));

vi.mock('services/authentication/loginState', () => ({
  getLoginState: () => ({ email: 'me@test.com' }),
}));

// Vitest runs in Node — provide an in-memory localStorage.
const memStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memStore[k] ?? null,
  setItem: (k: string, v: string) => {
    memStore[k] = v;
  },
  removeItem: (k: string) => {
    delete memStore[k];
  },
  clear: () => {
    for (const k of Object.keys(memStore)) delete memStore[k];
  },
});

import {
  getMessages,
  receiveMessage,
  receiveHistory,
  receiveAccepted,
  sendMessage,
  setChatSendFn,
  setChatGapFn,
  clearChat,
} from './chatService';

describe('chatService persistence', () => {
  beforeEach(() => {
    uuidCounter = 0;
    localStorage.clear();
    clearChat();
    setChatSendFn(() => {});
    setChatGapFn(() => {});
  });

  afterEach(() => {
    setChatSendFn(() => {});
    setChatGapFn(() => {});
  });

  it('orders received messages by seq and dedupes', () => {
    receiveMessage({ userName: 'a', message: 'second', timestamp: 2, seq: 5 });
    receiveMessage({ userName: 'b', message: 'first', timestamp: 1, seq: 3 });
    receiveMessage({ userName: 'a', message: 'dupe', timestamp: 2, seq: 5 }); // ignored

    const msgs = getMessages();
    expect(msgs.map((m) => m.seq)).toEqual([3, 5]);
    expect(msgs.map((m) => m.message)).toEqual(['first', 'second']);
  });

  it('reconciles an optimistic own message via chatAccepted (no duplicate)', () => {
    let sent: any;
    setChatSendFn((d) => (sent = d));
    sendMessage('hello');

    let mine = getMessages();
    expect(mine).toHaveLength(1);
    expect(mine[0].deliveryState).toBe('sending');
    expect(mine[0].seq).toBeUndefined();
    expect(sent.clientMsgId).toBe('cid-1');
    // provider/tournament metadata rides along for the admin monitor.
    expect(sent).toMatchObject({ tournamentId: 't1', providerAbbr: 'ACME', tournamentName: 'Open' });

    receiveAccepted({ clientMsgId: 'cid-1', seq: 9, timestamp: 100 });
    mine = getMessages();
    expect(mine).toHaveLength(1); // upgraded in place, not duplicated
    expect(mine[0].seq).toBe(9);
    expect(mine[0].deliveryState).toBe('accepted');
  });

  it('merges history and dedupes our own acked message by clientMsgId', () => {
    setChatSendFn(() => {});
    sendMessage('mine'); // cid-1, optimistic
    receiveAccepted({ clientMsgId: 'cid-1', seq: 4, timestamp: 50 });

    // History echoes our message (seq 4) plus another — must not duplicate ours.
    receiveHistory({
      tournamentId: 't1',
      messages: [
        { userName: 'me@test.com', message: 'mine', timestamp: 50, seq: 4, clientMsgId: 'cid-1' },
        { userName: 'x', message: 'theirs', timestamp: 60, seq: 6 },
      ],
    });

    const msgs = getMessages();
    expect(msgs.map((m) => m.seq)).toEqual([4, 6]);
    expect(msgs.filter((m) => m.clientMsgId === 'cid-1')).toHaveLength(1);
  });

  it('requests a gap fill when the backfill window starts after the last-seen seq', () => {
    const gap = vi.fn();
    setChatGapFn(gap);
    // Pretend we previously saw up to seq 2 in this tournament.
    localStorage.setItem('tmx_chat_lastSeenSeq', JSON.stringify({ t1: 2 }));

    // Backfill only carries seq >= 10 — there's a hole between 2 and 10.
    receiveHistory({ tournamentId: 't1', messages: [{ userName: 'x', message: 'recent', timestamp: 1, seq: 10 }] });

    expect(gap).toHaveBeenCalledWith({ tournamentId: 't1', afterSeq: 2 });
  });

  it('does not gap-fill a contiguous backfill', () => {
    const gap = vi.fn();
    setChatGapFn(gap);
    localStorage.setItem('tmx_chat_lastSeenSeq', JSON.stringify({ t1: 9 }));
    receiveHistory({ tournamentId: 't1', messages: [{ userName: 'x', message: 'r', timestamp: 1, seq: 10 }] });
    expect(gap).not.toHaveBeenCalled();
  });
});

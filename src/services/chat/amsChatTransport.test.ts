/**
 * Tournament chat on courthive-ams and score-relay: what the transport hands chatService for each answer AMS gives,
 * and the order it joins the relay room in. fetch, socket.io-client and chatService are mocked; the end-to-end proof
 * is Guidon's `chat` journey.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const chat = vi.hoisted(() => ({
  receiveAccepted: vi.fn(),
  receiveHistory: vi.fn(),
  receiveMessage: vi.fn(),
  receiveRejected: vi.fn(),
  setChatGapFn: vi.fn(),
  setChatSendFn: vi.fn(),
  setOnlineCount: vi.fn(),
}));
vi.mock('services/chat/chatService', () => chat);

const admin = vi.hoisted(() => ({
  receiveAdminChatFeed: vi.fn(),
  receiveAdminChatHistory: vi.fn(),
  setAdminMonitorFns: vi.fn(),
}));
vi.mock('services/chat/adminChatService', () => admin);

vi.mock('services/apis/facilitiesApi', () => ({
  getAmsBaseUrl: () => 'http://ams.test',
  authHeaders: () => ({ Authorization: 'Bearer user-jwt' }),
}));

const relay = vi.hoisted(() => ({ target: undefined as { origin: string; path: string } | undefined }));
vi.mock('services/messaging/scoreRelay', () => ({ relaySocketTarget: () => relay.target }));

const socket = vi.hoisted(() => {
  const handlers = new Map<string, (...args: any[]) => void>();
  return {
    handlers,
    instance: {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => handlers.set(event, handler)),
      emit: vi.fn(),
      disconnect: vi.fn(),
    },
  };
});
vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket.instance) }));

import { closeAmsChat, enterChat, installAmsChat } from './amsChatTransport';
import { io } from 'socket.io-client';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as any;

const answer = (status: number, data: unknown) => Promise.resolve({ status, json: () => Promise.resolve(data) });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function installedSend(): (data: any) => void {
  installAmsChat();
  return chat.setChatSendFn.mock.calls.at(-1)![0];
}

const ROOM_TOKEN = '/chat/room-token';
const RELAY = 'http://relay.test';
const message = { tournamentId: 't1', message: 'hello', clientMsgId: 'c1', userName: 'a@x', providerId: 'FORGED' };

beforeEach(() => {
  vi.clearAllMocks();
  socket.handlers.clear();
  relay.target = undefined;
  closeAmsChat();
});

describe('send', () => {
  it('posts to AMS only the message, its tournament and its id, and hands chatService the acceptance', async () => {
    const accepted = { clientMsgId: 'c1', seq: 41, timestamp: 1 };
    fetchMock.mockReturnValueOnce(answer(200, { accepted }));
    installedSend()(message);
    await settle();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://ams.test/chat/messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ tournamentId: 't1', message: 'hello', clientMsgId: 'c1' });
    expect(chat.receiveAccepted).toHaveBeenCalledWith(accepted);
  });

  it("hands chatService AMS's refusal, with its reason", async () => {
    const rejected = { clientMsgId: 'c1', error: "Only members of this tournament's provider can chat here" };
    fetchMock.mockReturnValueOnce(answer(200, { rejected }));
    installedSend()(message);
    await settle();
    expect(chat.receiveRejected).toHaveBeenCalledWith(rejected);
  });

  it('turns no answer at all into a refusal the panel can retry, not a message left at sending', async () => {
    fetchMock.mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')));
    installedSend()(message);
    await settle();
    expect(chat.receiveRejected).toHaveBeenCalledWith({ clientMsgId: 'c1', error: 'no response' });
  });

  it('sends one at a time, in order', async () => {
    let release!: () => void;
    fetchMock
      .mockReturnValueOnce(new Promise((resolve) => (release = () => resolve(answer(200, { accepted: {} })))))
      .mockReturnValue(answer(200, { accepted: {} }));
    const send = installedSend();
    send({ ...message, clientMsgId: 'first' });
    send({ ...message, clientMsgId: 'second' });
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release();
    await settle();
    await settle();
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).clientMsgId)).toEqual(['first', 'second']);
  });
});

describe('enterChat', () => {
  it('loads history from AMS, and opens no socket when there is no relay', async () => {
    const messages = [{ seq: 1, message: 'earlier' }];
    fetchMock.mockReturnValueOnce(answer(200, { messages }));
    enterChat('t1');
    await settle();
    expect(fetchMock.mock.calls[0][0]).toBe('http://ams.test/chat/tournaments/t1/messages');
    expect(chat.receiveHistory).toHaveBeenCalledWith({ tournamentId: 't1', messages });
    expect(io).not.toHaveBeenCalled();
  });

  it('on every connect: mints a room token, joins with it, and reloads history once joined', async () => {
    relay.target = { origin: RELAY, path: '/relay/socket.io/' };
    fetchMock.mockImplementation((url: string) =>
      url.endsWith(ROOM_TOKEN) ? answer(200, { token: 'room-token' }) : answer(200, { messages: [] }),
    );
    enterChat('t1');
    expect(io).toHaveBeenCalledWith('http://relay.test/chat', expect.objectContaining({ path: '/relay/socket.io/' }));

    for (const round of [1, 2]) {
      socket.handlers.get('connect')!();
      await settle();
      const join = socket.instance.emit.mock.calls.filter(([event]) => event === 'joinChat');
      expect(join, `connect ${round}`).toHaveLength(round);
      expect(join.at(-1)![1]).toEqual({ token: 'room-token' });
      join.at(-1)![2]({ ok: true, tournamentId: 't1', admin: false });
      await settle();
    }
    const mints = fetchMock.mock.calls.filter(([url]) => url.endsWith(ROOM_TOKEN));
    expect(mints, 'a fresh token for every join, so an expired one is never presented').toHaveLength(2);
    // Entering, then once after each join.
    expect(chat.receiveHistory).toHaveBeenCalledTimes(3);
  });

  it('joins nothing when AMS refuses the token, and still has the history it may read', async () => {
    relay.target = { origin: RELAY, path: '/socket.io/' };
    fetchMock.mockReturnValue(answer(403, { message: 'no' }));
    enterChat('t1');
    socket.handlers.get('connect')!();
    await settle();
    expect(socket.instance.emit).not.toHaveBeenCalledWith('joinChat', expect.anything(), expect.anything());
    expect(chat.receiveHistory).not.toHaveBeenCalled();
  });

  it("takes only its own tournament's messages and the room's presence from the relay", () => {
    relay.target = { origin: RELAY, path: '/socket.io/' };
    fetchMock.mockReturnValue(answer(200, { messages: [] }));
    enterChat('t1');
    socket.handlers.get('chatMessage')!({ tournamentId: 'other', seq: 2 });
    socket.handlers.get('chatMessage')!({ tournamentId: 't1', seq: 3 });
    socket.handlers.get('chatPresence')!({ tournamentId: 't1', count: 2 });
    expect(chat.receiveMessage.mock.calls).toEqual([[{ tournamentId: 't1', seq: 3 }]]);
    expect(chat.setOnlineCount).toHaveBeenCalledWith({ tournamentId: 't1', count: 2 });
  });
});

/**
 * Tournament chat on courthive-ams and score-relay (Mentat/planning/CHAT_TO_AMS.md, phase 3).
 *
 * AMS stores every message and decides who may chat; the relay delivers. CFS is not in the path:
 *
 *  - send       `POST {AMS}/chat/messages` → `{ accepted }` | `{ rejected }`, mapped exactly as CFS's answer was
 *               (`toChatOutcome`), so chatService takes the same `chatAccepted` / `chatRejected` it always has.
 *  - history    `GET {AMS}/chat/tournaments/:id/messages`, on entering a tournament and after every (re)join of
 *               the relay room, so whatever was missed while the room was not joined is filled from storage. A
 *               longer absence is filled by `?since=` (chatService's gap detection calls `gapFill`).
 *  - live       the relay's `/chat`, joined with a room token minted from AMS on every connect. A relay restart or a
 *               dropped link reconnects, re-mints, rejoins and reloads history: nothing sent meanwhile is lost.
 *  - presence   the relay's `chatPresence` for the joined room.
 *  - monitor    the super-admin view: `GET {AMS}/chat/monitor`, and the relay's admin feed on a monitor token.
 *
 * A caller AMS refuses (not a member of the tournament's provider, chat off) gets no token, so no live room; a send
 * still goes, and comes back rejected with the reason, which the panel shows on "⚠ Retry".
 */
import { receiveAdminChatFeed, receiveAdminChatHistory, setAdminMonitorFns } from 'services/chat/adminChatService';
import { toChatOutcome } from 'services/messaging/transport/httpCommands';
import { authHeaders, getAmsBaseUrl } from 'services/apis/facilitiesApi';
import { relaySocketTarget } from 'services/messaging/scoreRelay';
import { serverConfig } from 'config/serverConfig';
import { debugConfig } from 'config/debugConfig';
import { tools } from 'tods-competition-factory';
import { io, Socket } from 'socket.io-client';
import {
  receiveAccepted,
  receiveHistory,
  receiveMessage,
  receiveRejected,
  setChatGapFn,
  setChatSendFn,
  setOnlineCount,
} from 'services/chat/chatService';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

/** Whether chat runs on AMS and the relay (the default) rather than on CFS. */
export const chatOnAms = (): boolean => serverConfig.get().chatBackend === 'ams';

type AmsAnswer = { status: number; data: any } | undefined;

async function amsRequest(method: 'GET' | 'POST', path: string, body?: unknown): Promise<AmsAnswer> {
  try {
    const response = await fetch(`${getAmsBaseUrl()}${path}`, {
      method,
      headers: authHeaders(),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json().catch(() => undefined) };
  } catch {
    // No answer at all: the caller treats it as one (a send becomes "⚠ Retry: no response").
    return undefined;
  }
}

function historyPath(tournamentId: string, since?: number): string {
  const path = `/chat/tournaments/${encodeURIComponent(tournamentId)}/messages`;
  return since === undefined ? path : `${path}?since=${since}`;
}

// ── send ──

/** One at a time, so AMS assigns seqs in the order this tab sent the messages. */
let chain: Promise<unknown> = Promise.resolve();

function send(data: { tournamentId: string; message: string; clientMsgId?: string }): void {
  const run = chain.then(async () => {
    const answer = await amsRequest('POST', '/chat/messages', {
      tournamentId: data.tournamentId,
      message: data.message,
      clientMsgId: data.clientMsgId,
    });
    const { deliver } = toChatOutcome(data.clientMsgId, answer);
    if (deliver?.event === 'chatAccepted') receiveAccepted(deliver.payload);
    else if (deliver) receiveRejected(deliver.payload);
  });
  chain = run.catch(() => undefined);
}

// ── the tournament room ──

let roomSocket: Socket | undefined;
let roomTournamentId: string | undefined;

async function loadHistory(tournamentId: string, since?: number): Promise<void> {
  const answer = await amsRequest('GET', historyPath(tournamentId, since));
  if (roomTournamentId !== tournamentId) return;
  if (answer?.status !== 200) {
    slog('[chat] history for %s: %s', tournamentId, answer?.status ?? 'no response');
    return;
  }
  receiveHistory({
    tournamentId,
    messages: answer.data?.messages ?? [],
    ...(since === undefined ? {} : { gap: true }),
  });
}

function gapFill({ tournamentId, afterSeq }: { tournamentId: string; afterSeq: number }): void {
  void loadHistory(tournamentId, afterSeq);
}

async function joinRoom(socket: Socket, tournamentId: string): Promise<void> {
  const answer = await amsRequest('POST', '/chat/room-token', { tournamentId });
  if (socket !== roomSocket) return;
  const token = answer?.status === 200 ? answer.data?.token : undefined;
  if (!token) {
    slog('[chat] no room token for %s (%s): no live room', tournamentId, answer?.status ?? 'no response');
    return;
  }
  socket.emit('joinChat', { token }, (reply: { ok: boolean; error?: string }) => {
    if (socket !== roomSocket) return;
    if (!reply?.ok) {
      slog('[chat] relay refused the room token for %s: %s', tournamentId, reply?.error);
      return;
    }
    // Whatever arrived while the room was not joined (first join, relay restart, dropped link) comes from storage.
    void loadHistory(tournamentId);
  });
}

/** Enter a tournament's chat: its history, and its live room when the relay is there and AMS issues a token. */
export function enterChat(tournamentId: string): void {
  // Already in its room: a reload of the same tournament clears the panel (clearChat), so history comes again.
  if (roomTournamentId === tournamentId && roomSocket) {
    void loadHistory(tournamentId);
    return;
  }
  leaveChat();
  roomTournamentId = tournamentId;
  void loadHistory(tournamentId);

  const target = relaySocketTarget();
  if (!target) return;
  const socket = io(`${target.origin}/chat`, { path: target.path, transports: ['websocket'], forceNew: true });
  roomSocket = socket;
  socket.on('connect', () => void joinRoom(socket, tournamentId));
  socket.on('chatMessage', (message: any) => {
    if (message?.tournamentId === roomTournamentId) receiveMessage(message);
  });
  socket.on('chatPresence', (presence: any) => setOnlineCount(presence));
}

export function leaveChat(): void {
  roomTournamentId = undefined;
  if (!roomSocket) return;
  roomSocket.emit('leaveChat');
  roomSocket.disconnect();
  roomSocket = undefined;
}

// ── the super-admin monitor ──

let monitorSocket: Socket | undefined;

async function joinMonitorFeed(socket: Socket): Promise<void> {
  const answer = await amsRequest('POST', '/chat/monitor/token');
  const token = answer?.status === 200 ? answer.data?.token : undefined;
  if (socket !== monitorSocket || !token) return;
  socket.emit('joinChat', { token }, (reply: { ok: boolean; error?: string }) => {
    if (!reply?.ok) slog('[chat] relay refused the monitor token: %s', reply?.error);
  });
}

async function startMonitor(): Promise<void> {
  const answer = await amsRequest('GET', '/chat/monitor');
  if (answer?.status === 200) receiveAdminChatHistory({ messages: answer.data?.messages ?? [] });

  const target = relaySocketTarget();
  if (!target || monitorSocket) return;
  const socket = io(`${target.origin}/chat`, { path: target.path, transports: ['websocket'], forceNew: true });
  monitorSocket = socket;
  socket.on('connect', () => void joinMonitorFeed(socket));
  socket.on('adminChatFeed', receiveAdminChatFeed);
}

function stopMonitor(): void {
  monitorSocket?.disconnect();
  monitorSocket = undefined;
}

function monitorReply(data: { tournamentId: string; message: string }): void {
  // The reply reaches the monitor through the admin feed, like every other message.
  void amsRequest('POST', '/chat/monitor/reply', {
    tournamentId: data.tournamentId,
    message: data.message,
    clientMsgId: tools.UUID(),
  });
}

/** Point chatService and the monitor at AMS and the relay. */
export function installAmsChat(): void {
  setChatSendFn(send);
  setChatGapFn(gapFill);
  setAdminMonitorFns({ join: () => void startMonitor(), leave: stopMonitor, reply: monitorReply });
}

/** Everything off: a logout, or the transport torn down. */
export function closeAmsChat(): void {
  leaveChat();
  stopMonitor();
}

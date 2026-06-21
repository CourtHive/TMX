/**
 * Tournament chat service.
 *
 * Messages are persisted server-side (see Mentat/planning/TMX_PERSISTED_CHAT.md):
 *  - On join/reconnect the server emits `chatHistory` (last 24h) which we merge.
 *  - Each message carries a server-authoritative `seq` (global bigserial) used
 *    for ordering and de-duplication. Per-tournament seqs are NOT contiguous
 *    (other tournaments interleave), so gap detection happens on rejoin — if
 *    the backfill window starts after our last-seen seq we request `chatSince`.
 *  - Our own sent messages are optimistic (deliveryState 'sending') and carry a
 *    `clientMsgId`; the server's `chatAccepted` ack upgrades them in place with
 *    the real seq, which also de-dupes them against history/gap fetches.
 *
 * `lastReadAt` (unread badge) and `lastSeenSeq` (delivery/gap) are distinct
 * signals, both persisted per tournament in localStorage.
 */
import { getLoginState } from 'services/authentication/loginState';
import { tournamentEngine } from 'services/factory/engine';
import { tools } from 'tods-competition-factory';

export interface ChatMessage {
  userName: string;
  message: string;
  timestamp: number;
  isOwn?: boolean;
  isAdmin?: boolean;
  /** Server-authoritative ordering key. Absent only on an unacked own message. */
  seq?: number;
  /** Reconciliation key for our own optimistic messages. */
  clientMsgId?: string;
  deliveryState?: 'sending' | 'accepted' | 'failed';
}

interface IncomingMessage {
  userName: string;
  message: string;
  timestamp: number;
  seq?: number;
  clientMsgId?: string;
  isAdmin?: boolean;
}

type ChatListener = () => void;

const LAST_READ_STORAGE_KEY = 'tmx_chat_lastReadAt';
const LAST_SEEN_SEQ_KEY = 'tmx_chat_lastSeenSeq';

// ── State ──

let messages: ChatMessage[] = [];
let unreadCount = 0;
let modalOpen = false;
let onlineCount = 0;

const listeners = new Set<ChatListener>();

// ── Socket fns (injected by socketIo.ts to avoid circular deps) ──

let sendFn: ((data: any) => void) | undefined;
let gapFn: ((data: { tournamentId: string; afterSeq: number }) => void) | undefined;

export function setChatSendFn(fn: (data: any) => void): void {
  sendFn = fn;
}

export function setChatGapFn(fn: (data: { tournamentId: string; afterSeq: number }) => void): void {
  gapFn = fn;
}

// ── Public API ──

export function getMessages(): readonly ChatMessage[] {
  return messages;
}

export function getUnreadCount(): number {
  return unreadCount;
}

export function getOnlineCount(): number {
  return onlineCount;
}

export function onChatUpdate(fn: ChatListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setChatModalOpen(open: boolean): void {
  modalOpen = open;
  if (open) {
    const tournamentId = getActiveTournamentId();
    if (tournamentId) writeLastReadAt(tournamentId, Date.now());
    unreadCount = 0;
    notify();
  }
}

export function sendMessage(text: string): void {
  const trimmed = text.trim();
  if (!trimmed || !sendFn) return;

  const state = getLoginState();
  const userName = state?.email || 'Anonymous';
  const tournamentId = getActiveTournamentId();
  if (!tournamentId) return;

  const clientMsgId = tools.UUID();
  const msg: ChatMessage = {
    userName,
    message: trimmed,
    timestamp: Date.now(),
    isOwn: true,
    clientMsgId,
    deliveryState: 'sending',
  };

  messages = [...messages, msg];
  // Sending counts as reading — your own message clears the unread badge.
  writeLastReadAt(tournamentId, msg.timestamp);
  unreadCount = 0;
  notify();

  const meta = getProviderTournamentMeta();
  sendFn({ tournamentId, userName, message: trimmed, clientMsgId, ...meta });
}

/** Called by socketIo on a `chatMessage` event relayed from the server. */
export function receiveMessage(data: IncomingMessage): void {
  // A relay of our own message (shouldn't normally happen — sender is excluded
  // — but admin replies / races can) reconciles instead of duplicating.
  if (data.clientMsgId && reconcileOwn(data.clientMsgId, data.seq, data.timestamp)) {
    advanceLastSeenSeq(data.seq);
    notify();
    return;
  }
  if (data.seq !== undefined && messages.some((m) => m.seq === data.seq)) return; // dedupe

  insertMessage({
    userName: data.userName,
    message: data.message,
    timestamp: data.timestamp,
    seq: data.seq,
    isAdmin: data.isAdmin,
    isOwn: false,
  });
  if (!modalOpen) unreadCount++;
  advanceLastSeenSeq(data.seq);
  notify();
}

/** Called by socketIo on a `chatAccepted` ack for one of our sent messages. */
export function receiveAccepted(data: { clientMsgId: string; seq: number; timestamp: number }): void {
  if (reconcileOwn(data.clientMsgId, data.seq, data.timestamp, 'accepted')) {
    advanceLastSeenSeq(data.seq);
    notify();
  }
}

/** Called by socketIo on a `chatRejected` event for one of our sent messages. */
export function receiveRejected(data: { clientMsgId: string }): void {
  const msg = messages.find((m) => m.clientMsgId === data.clientMsgId);
  if (msg) {
    msg.deliveryState = 'failed';
    notify();
  }
}

/**
 * Called by socketIo on a `chatHistory` event (join backfill or gap fill).
 * Merges by seq, advances lastSeenSeq, recomputes unread, and — when the
 * backfill window starts after our prior last-seen seq — requests a gap fill.
 */
export function receiveHistory(data: { tournamentId: string; messages: IncomingMessage[]; gap?: boolean }): void {
  const tournamentId = getActiveTournamentId();
  if (!tournamentId || data.tournamentId !== tournamentId) return;

  const priorLastSeen = readLastSeenSeq(tournamentId);
  const incoming = data.messages ?? [];

  for (const m of incoming) {
    if (m.clientMsgId && reconcileOwn(m.clientMsgId, m.seq, m.timestamp, 'accepted')) continue;
    if (m.seq !== undefined && messages.some((x) => x.seq === m.seq)) continue;
    insertMessage({
      userName: m.userName,
      message: m.message,
      timestamp: m.timestamp,
      seq: m.seq,
      isAdmin: m.isAdmin,
      isOwn: isOwnUser(m.userName),
    });
  }

  for (const m of incoming) advanceLastSeenSeq(m.seq);

  // Long-absence gap fill: if this was the initial join backfill (not itself a
  // gap response) and every message it carried is newer than what we last saw,
  // there may be a hole between priorLastSeen and the backfill window — fetch
  // it. Dedup makes an overlapping response harmless.
  if (!data.gap && priorLastSeen > 0 && incoming.length && gapFn) {
    const minSeq = Math.min(...incoming.map((m) => m.seq ?? Number.POSITIVE_INFINITY));
    if (Number.isFinite(minSeq) && minSeq > priorLastSeen + 1) {
      gapFn({ tournamentId, afterSeq: priorLastSeen });
    }
  }

  recomputeUnread(tournamentId);
  notify();
}

/** Called by socketIo when the server emits roomPresence for the active room. */
export function setOnlineCount(data: { tournamentId: string; count: number }): void {
  const active = getActiveTournamentId();
  if (!active || data.tournamentId !== active) return;
  if (onlineCount === data.count) return;
  onlineCount = data.count;
  notify();
}

/** Clear messages when switching tournaments. */
export function clearChat(): void {
  messages = [];
  onlineCount = 0;
  const tournamentId = getActiveTournamentId();
  unreadCount = tournamentId ? Math.max(0, computeUnreadFromMessages(tournamentId)) : 0;
  notify();
}

// ── Internal ──

function notify(): void {
  for (const fn of listeners) fn();
}

/** Insert keeping ascending order — by seq when present, else appended (an
 *  unacked own message sorts after everything until its seq arrives). */
function insertMessage(msg: ChatMessage): void {
  if (msg.seq === undefined) {
    messages = [...messages, msg];
    return;
  }
  const next = messages.filter((m) => m.seq !== msg.seq);
  let i = next.length;
  while (i > 0 && next[i - 1].seq !== undefined && (next[i - 1].seq as number) > (msg.seq as number)) i--;
  next.splice(i, 0, msg);
  messages = next;
}

/** Upgrade an optimistic own message to its persisted identity. */
function reconcileOwn(
  clientMsgId: string,
  seq?: number,
  timestamp?: number,
  deliveryState: ChatMessage['deliveryState'] = 'accepted',
): boolean {
  const msg = messages.find((m) => m.clientMsgId === clientMsgId);
  if (!msg) return false;
  if (seq !== undefined) msg.seq = seq;
  if (timestamp !== undefined) msg.timestamp = timestamp;
  msg.deliveryState = deliveryState;
  // Re-sort now that it has a seq.
  if (seq !== undefined) {
    messages = [...messages].sort(bySeq);
  }
  return true;
}

function bySeq(a: ChatMessage, b: ChatMessage): number {
  const as = a.seq ?? Number.POSITIVE_INFINITY;
  const bs = b.seq ?? Number.POSITIVE_INFINITY;
  if (as !== bs) return as - bs;
  return a.timestamp - b.timestamp;
}

function isOwnUser(userName: string): boolean {
  const state = getLoginState();
  return !!state?.email && state.email === userName;
}

function getActiveTournamentId(): string | undefined {
  const { tournamentRecord } = tournamentEngine.getTournament();
  return tournamentRecord?.tournamentId;
}

/** Provider + tournament identity attached to outgoing messages so the
 *  super-admin monitor can render its grouping pills. */
function getProviderTournamentMeta(): { providerId?: string; providerAbbr?: string; tournamentName?: string } {
  const { tournamentRecord } = tournamentEngine.getTournament();
  const org = tournamentRecord?.parentOrganisation;
  return {
    providerId: org?.organisationId,
    providerAbbr: org?.organisationAbbreviation || org?.organisationName,
    tournamentName: tournamentRecord?.tournamentName,
  };
}

function recomputeUnread(tournamentId: string): void {
  unreadCount = modalOpen ? 0 : Math.max(0, computeUnreadFromMessages(tournamentId));
}

function computeUnreadFromMessages(tournamentId: string): number {
  const lastReadAt = readLastReadAt(tournamentId);
  let count = 0;
  for (const m of messages) {
    if (!m.isOwn && m.timestamp > lastReadAt) count++;
  }
  return count;
}

// ── localStorage: lastReadAt (unread) ──

function readLastReadMap(): Record<string, number> {
  return readNumberMap(LAST_READ_STORAGE_KEY);
}

function readLastReadAt(tournamentId: string): number {
  return readLastReadMap()[tournamentId] ?? 0;
}

function writeLastReadAt(tournamentId: string, timestamp: number): void {
  writeNumberMapEntry(LAST_READ_STORAGE_KEY, tournamentId, timestamp);
}

// ── localStorage: lastSeenSeq (delivery / gap) ──

function readLastSeenSeq(tournamentId: string): number {
  return readNumberMap(LAST_SEEN_SEQ_KEY)[tournamentId] ?? 0;
}

function advanceLastSeenSeq(seq?: number): void {
  if (seq === undefined) return;
  const tournamentId = getActiveTournamentId();
  if (!tournamentId) return;
  if (seq > readLastSeenSeq(tournamentId)) writeNumberMapEntry(LAST_SEEN_SEQ_KEY, tournamentId, seq);
}

// ── localStorage helpers ──

function readNumberMap(key: string): Record<string, number> {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeNumberMapEntry(key: string, id: string, value: number): void {
  try {
    const map = readNumberMap(key);
    map[id] = value;
    globalThis.localStorage?.setItem(key, JSON.stringify(map));
  } catch {
    // ignore — quota errors or disabled storage shouldn't break chat
  }
}

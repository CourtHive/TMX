/**
 * Tournament chat service.
 * Manages message store, unread count, online presence, and send/receive
 * for the tournament room chat. Messages are ephemeral — not persisted across
 * page reloads. Only `lastReadAt` per tournament is persisted in localStorage
 * so the unread badge survives reloads.
 */
import { getLoginState } from 'services/authentication/loginState';
import { tournamentEngine } from 'tods-competition-factory';

export interface ChatMessage {
  userName: string;
  message: string;
  timestamp: number;
  isOwn?: boolean;
}

type ChatListener = () => void;

const LAST_READ_STORAGE_KEY = 'tmx_chat_lastReadAt';

// ── State ──

let messages: ChatMessage[] = [];
let unreadCount = 0;
let modalOpen = false;
let onlineCount = 0;

const listeners = new Set<ChatListener>();

// ── Socket send function (injected by socketIo.ts to avoid circular deps) ──

let sendFn: ((data: any) => void) | undefined;

export function setChatSendFn(fn: (data: any) => void): void {
  sendFn = fn;
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

  const msg: ChatMessage = {
    userName,
    message: trimmed,
    timestamp: Date.now(),
    isOwn: true,
  };

  messages = [...messages, msg];
  // Sending counts as reading — your own message clears the unread badge.
  writeLastReadAt(tournamentId, msg.timestamp);
  unreadCount = 0;
  notify();

  sendFn({ tournamentId, userName, message: trimmed });
}

/** Called by socketIo when a chatMessage event is received from the server. */
export function receiveMessage(data: { userName: string; message: string; timestamp: number }): void {
  const msg: ChatMessage = {
    userName: data.userName,
    message: data.message,
    timestamp: data.timestamp,
    isOwn: false,
  };

  messages = [...messages, msg];
  if (!modalOpen) unreadCount++;
  notify();
}

/** Called by socketIo when the server emits roomPresence for the active tournament room. */
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
  // Re-derive unread count from persisted lastReadAt for the now-active tournament.
  const tournamentId = getActiveTournamentId();
  unreadCount = tournamentId ? Math.max(0, computeUnreadFromMessages(tournamentId)) : 0;
  notify();
}

// ── Internal ──

function notify(): void {
  for (const fn of listeners) fn();
}

function getActiveTournamentId(): string | undefined {
  const { tournamentRecord } = tournamentEngine.getTournament();
  return tournamentRecord?.tournamentId;
}

function computeUnreadFromMessages(tournamentId: string): number {
  const lastReadAt = readLastReadAt(tournamentId);
  let count = 0;
  for (const m of messages) {
    if (!m.isOwn && m.timestamp > lastReadAt) count++;
  }
  return count;
}

function readLastReadMap(): Record<string, number> {
  try {
    const raw = globalThis.localStorage?.getItem(LAST_READ_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function readLastReadAt(tournamentId: string): number {
  return readLastReadMap()[tournamentId] ?? 0;
}

function writeLastReadAt(tournamentId: string, timestamp: number): void {
  try {
    const map = readLastReadMap();
    map[tournamentId] = timestamp;
    globalThis.localStorage?.setItem(LAST_READ_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore — quota errors or disabled storage shouldn't break chat
  }
}

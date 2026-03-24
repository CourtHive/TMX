/**
 * Tournament chat service.
 * Manages message store, unread count, and send/receive for the tournament room chat.
 * Messages are ephemeral — not persisted across page reloads.
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

// ── State ──

let messages: ChatMessage[] = [];
let unreadCount = 0;
let modalOpen = false;

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

export function onChatUpdate(fn: ChatListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setChatModalOpen(open: boolean): void {
  modalOpen = open;
  if (open) {
    unreadCount = 0;
    notify();
  }
}

export function sendMessage(text: string): void {
  const trimmed = text.trim();
  if (!trimmed || !sendFn) return;

  const state = getLoginState();
  const userName = state?.email || 'Anonymous';
  const { tournamentRecord } = tournamentEngine.getTournament();
  const tournamentId = tournamentRecord?.tournamentId;
  if (!tournamentId) return;

  const msg: ChatMessage = {
    userName,
    message: trimmed,
    timestamp: Date.now(),
    isOwn: true,
  };

  messages = [...messages, msg];
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

/** Clear messages when switching tournaments. */
export function clearChat(): void {
  messages = [];
  unreadCount = 0;
  notify();
}

// ── Internal ──

function notify(): void {
  for (const fn of listeners) fn();
}

/**
 * Super-admin chat monitor store.
 *
 * A super-admin joins the server's `admin:chatMonitor` room and receives:
 *  - `adminChatHistory` once on join (cross-tournament backfill), and
 *  - `adminChatFeed` live for every message in every tournament/provider.
 *
 * Messages carry provider/tournament identity so the monitor UI can render
 * grouping pills. This store is independent of the per-tournament chatService.
 */

export interface AdminChatMessage {
  seq?: number;
  userName: string;
  message: string;
  timestamp: number;
  isAdmin?: boolean;
  tournamentId?: string;
  providerId?: string;
  providerAbbr?: string;
  tournamentName?: string;
}

type AdminChatListener = () => void;

const MAX_RETAINED = 1000;

let messages: AdminChatMessage[] = [];
let monitorActive = false;

const listeners = new Set<AdminChatListener>();

// Injected by socketIo.ts.
let monitorFns: { join: () => void; leave: () => void; reply: (data: any) => void } | undefined;

export function setAdminMonitorFns(fns: { join: () => void; leave: () => void; reply: (data: any) => void }): void {
  monitorFns = fns;
}

export function onAdminChatUpdate(fn: AdminChatListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAdminChatMessages(): readonly AdminChatMessage[] {
  return messages;
}

export function isMonitorActive(): boolean {
  return monitorActive;
}

/** Open the monitor: join the room (server replies with adminChatHistory). */
export function startChatMonitor(): void {
  monitorActive = true;
  monitorFns?.join();
}

export function stopChatMonitor(): void {
  monitorActive = false;
  monitorFns?.leave();
}

/** Re-join after a reconnect if the monitor is open (called by socketIo). */
export function rejoinChatMonitorIfActive(): void {
  if (monitorActive) monitorFns?.join();
}

/** Super-admin replies into a specific tournament room from the monitor. */
export function sendAdminReply(params: {
  tournamentId: string;
  message: string;
  providerId?: string;
  providerAbbr?: string;
  tournamentName?: string;
}): void {
  const message = params.message.trim();
  if (!message) return;
  monitorFns?.reply({ ...params, message });
}

export function receiveAdminChatHistory(data: { messages: AdminChatMessage[] }): void {
  messages = dedupeSorted([...(data.messages ?? [])]);
  notify();
}

export function receiveAdminChatFeed(data: AdminChatMessage): void {
  if (!data) return;
  if (data.seq !== undefined && messages.some((m) => m.seq === data.seq)) return;
  messages = dedupeSorted([...messages, data]).slice(-MAX_RETAINED);
  notify();
}

// ── internal ──

function notify(): void {
  for (const fn of listeners) fn();
}

function dedupeSorted(list: AdminChatMessage[]): AdminChatMessage[] {
  const bySeq = new Map<number, AdminChatMessage>();
  const noSeq: AdminChatMessage[] = [];
  for (const m of list) {
    if (m.seq === undefined) noSeq.push(m);
    else bySeq.set(m.seq, m);
  }
  return [...bySeq.values(), ...noSeq].sort((a, b) => {
    const as = a.seq ?? Number.POSITIVE_INFINITY;
    const bs = b.seq ?? Number.POSITIVE_INFINITY;
    if (as !== bs) return as - bs;
    return a.timestamp - b.timestamp;
  });
}

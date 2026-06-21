/**
 * Super-admin chat monitor.
 *
 * Floating panel showing the cross-tournament chat stream (history + live).
 * Messages are grouped by provider + tournament; whenever the grouping changes
 * in the stream a pill header is inserted naming the provider and tournament.
 * Selecting a group lets the admin reply into that tournament's room.
 *
 * Gated to super-admins by the caller (see tournamentsControls).
 */
import {
  startChatMonitor,
  stopChatMonitor,
  onAdminChatUpdate,
  getAdminChatMessages,
  sendAdminReply,
  type AdminChatMessage,
} from 'services/chat/adminChatService';

const PANEL_ID = 'chatMonitorPanel';
const PANEL_WIDTH = 420;

let unsubscribe: (() => void) | undefined;

interface ReplyTarget {
  tournamentId: string;
  providerId?: string;
  providerAbbr?: string;
  tournamentName?: string;
}

function groupKey(m: AdminChatMessage): string {
  return `${m.providerId ?? ''}|${m.tournamentId ?? ''}`;
}

function groupLabel(m: AdminChatMessage): string {
  const provider = m.providerAbbr || 'Unknown provider';
  const tournament = m.tournamentName || m.tournamentId || 'Unknown tournament';
  return `${provider} · ${tournament}`;
}

export function openChatMonitorModal(): void {
  if (document.getElementById(PANEL_ID)) {
    closeChatMonitor();
    return;
  }

  startChatMonitor();

  let stream: HTMLElement;
  let replyInput: HTMLInputElement;
  let replyLabel: HTMLElement;
  let replyTarget: ReplyTarget | null = null;

  const setReplyTarget = (t: ReplyTarget) => {
    replyTarget = t;
    replyLabel.textContent = `Reply to ${t.providerAbbr || 'provider'} · ${t.tournamentName || t.tournamentId}`;
    replyInput.disabled = false;
    replyInput.focus();
  };

  const render = () => {
    if (!stream) return;
    const messages = getAdminChatMessages();
    stream.innerHTML = '';

    if (!messages.length) {
      const empty = document.createElement('div');
      empty.style.cssText =
        'padding: 24px 12px; text-align: center; font-size: 0.8rem; color: var(--chc-text-secondary, #888);';
      empty.textContent = 'No chat activity in the recent window.';
      stream.appendChild(empty);
      return;
    }

    let lastKey = '';
    for (const msg of messages) {
      const key = groupKey(msg);
      if (key !== lastKey) {
        lastKey = key;
        stream.appendChild(buildGroupPill(msg, () =>
          setReplyTarget({
            tournamentId: msg.tournamentId ?? '',
            providerId: msg.providerId,
            providerAbbr: msg.providerAbbr,
            tournamentName: msg.tournamentName,
          }),
        ));
      }
      stream.appendChild(buildMessageRow(msg));
    }
    stream.scrollTop = stream.scrollHeight;
  };

  const handleReply = () => {
    const text = replyInput?.value;
    if (!text?.trim() || !replyTarget?.tournamentId) return;
    sendAdminReply({ ...replyTarget, message: text });
    replyInput.value = '';
    replyInput.focus();
  };

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = [
    'position: fixed',
    'top: 60px',
    'right: 16px',
    `width: ${PANEL_WIDTH}px`,
    'max-height: 560px',
    'display: flex',
    'flex-direction: column',
    'background: var(--chc-bg-primary, #fff)',
    'border: 1px solid var(--chc-border-primary, #ddd)',
    'border-radius: 12px',
    'box-shadow: 0 4px 24px rgba(0,0,0,0.18)',
    'z-index: 1000',
    'overflow: hidden',
  ].join('; ');

  // Header
  const header = document.createElement('div');
  header.style.cssText = [
    'display: flex',
    'align-items: center',
    'justify-content: space-between',
    'padding: 10px 14px',
    'border-bottom: 1px solid var(--chc-border-primary, #ddd)',
    'background: var(--chc-bg-secondary, #f8f8f8)',
  ].join('; ');
  const title = document.createElement('span');
  title.textContent = 'Chat Monitor — all tournaments';
  title.style.cssText = 'font-weight: 600; font-size: 0.9rem;';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close chat monitor');
  closeBtn.style.cssText =
    'border: none; background: transparent; cursor: pointer; font-size: 0.9rem; color: var(--chc-text-secondary, #888);';
  closeBtn.onclick = closeChatMonitor;
  header.appendChild(title);
  header.appendChild(closeBtn);

  // Stream
  stream = document.createElement('div');
  stream.style.cssText = 'flex: 1; overflow-y: auto; padding: 10px 12px; min-height: 0;';

  // Reply footer
  const footer = document.createElement('div');
  footer.style.cssText =
    'border-top: 1px solid var(--chc-border-primary, #ddd); padding: 8px 12px; display: flex; flex-direction: column; gap: 6px;';
  replyLabel = document.createElement('div');
  replyLabel.style.cssText = 'font-size: 0.72rem; color: var(--chc-text-secondary, #888);';
  replyLabel.textContent = 'Select a group pill to reply into that tournament';
  const replyRow = document.createElement('div');
  replyRow.style.cssText = 'display: flex; gap: 6px;';
  replyInput = document.createElement('input');
  replyInput.type = 'text';
  replyInput.placeholder = 'Reply as admin…';
  replyInput.disabled = true;
  replyInput.style.cssText =
    'flex: 1; padding: 6px 10px; border: 1px solid var(--chc-border-primary, #ddd); border-radius: 8px; font-size: 0.85rem;';
  replyInput.onkeydown = (e) => {
    if (e.key === 'Enter') handleReply();
  };
  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';
  sendBtn.style.cssText =
    'padding: 6px 12px; border: none; border-radius: 8px; background: var(--tmx-accent-blue, #3273dc); color: #fff; cursor: pointer; font-size: 0.85rem;';
  sendBtn.onclick = handleReply;
  replyRow.appendChild(replyInput);
  replyRow.appendChild(sendBtn);
  footer.appendChild(replyLabel);
  footer.appendChild(replyRow);

  panel.appendChild(header);
  panel.appendChild(stream);
  panel.appendChild(footer);
  document.body.appendChild(panel);

  unsubscribe = onAdminChatUpdate(render);
  render();
}

function closeChatMonitor(): void {
  stopChatMonitor();
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = undefined;
  }
  document.getElementById(PANEL_ID)?.remove();
}

function buildGroupPill(msg: AdminChatMessage, onClick: () => void): HTMLElement {
  const pill = document.createElement('button');
  pill.textContent = groupLabel(msg);
  pill.style.cssText = [
    'display: inline-block',
    'margin: 10px 0 6px',
    'padding: 2px 10px',
    'border-radius: 999px',
    'border: 1px solid var(--chc-border-primary, #e5e7eb)',
    'background: var(--chc-bg-secondary, #eef2ff)',
    'color: var(--chc-text-primary, #334155)',
    'font-size: 0.7rem',
    'font-weight: 600',
    'cursor: pointer',
  ].join('; ');
  pill.onclick = onClick;
  return pill;
}

function buildMessageRow(msg: AdminChatMessage): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 6px;';

  const bubble = document.createElement('div');
  bubble.style.cssText = [
    `background: ${msg.isAdmin ? 'var(--tmx-accent-blue, #3273dc)' : 'var(--chc-bg-secondary, #f0f0f0)'}`,
    `color: ${msg.isAdmin ? '#fff' : 'var(--chc-text-primary, #333)'}`,
    'padding: 6px 12px',
    'border-radius: 12px',
    'max-width: 90%',
    'word-break: break-word',
    'font-size: 0.88rem',
  ].join('; ');
  bubble.textContent = msg.message;

  const meta = document.createElement('div');
  meta.style.cssText = 'font-size: 0.68rem; color: var(--chc-text-secondary, #888); margin-top: 2px; padding: 0 4px;';
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.textContent = `${msg.userName}${msg.isAdmin ? ' (admin)' : ''} · ${time}`;

  row.appendChild(bubble);
  row.appendChild(meta);
  return row;
}

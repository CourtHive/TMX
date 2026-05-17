/**
 * Tournament chat panel.
 * Floating panel (not a modal) so the user can keep it open while working.
 */
import { getMessages, getOnlineCount, sendMessage, setChatModalOpen, onChatUpdate } from 'services/chat/chatService';

const PANEL_ID = 'chatPanel';
const PANEL_WIDTH = 340;
const POSITION_KEY = 'tmx.chatPanel.position';
// Minimum number of pixels of the panel that must stay inside the viewport
// after restore — if the saved spot leaves less than this on screen, we
// clamp instead. Lets the header stay grabbable after a monitor change.
const MIN_ONSCREEN = 80;

let unsubscribe: (() => void) | undefined;

interface PanelPosition {
  left: number;
  top: number;
}

function loadPanelPosition(): PanelPosition | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelPosition>;
    if (typeof parsed.left !== 'number' || typeof parsed.top !== 'number') return null;
    return { left: parsed.left, top: parsed.top };
  } catch {
    return null;
  }
}

function savePanelPosition(pos: PanelPosition): void {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
  } catch {
    // Storage quota or disabled — silently ignore; the panel just won't
    // remember its position next session.
  }
}

function clampPosition(pos: PanelPosition): PanelPosition {
  const maxLeft = window.innerWidth - MIN_ONSCREEN;
  const maxTop = window.innerHeight - MIN_ONSCREEN;
  return {
    left: Math.max(0, Math.min(pos.left, maxLeft)),
    top: Math.max(0, Math.min(pos.top, maxTop)),
  };
}

export function openChatModal(): void {
  // Toggle — if already open, close it
  if (document.getElementById(PANEL_ID)) {
    closeChatPanel();
    return;
  }

  setChatModalOpen(true);

  let messagesContainer: HTMLElement;
  let input: HTMLInputElement;
  let presenceLabel: HTMLElement;

  const renderPresence = () => {
    if (!presenceLabel) return;
    const count = getOnlineCount();
    if (count > 0) {
      presenceLabel.style.display = 'inline-flex';
      presenceLabel.title = `${count} online`;
      presenceLabel.querySelector('span')!.textContent = String(count);
    } else {
      presenceLabel.style.display = 'none';
    }
  };

  const renderMessages = () => {
    if (!messagesContainer) return;
    const messages = getMessages();
    messagesContainer.innerHTML = '';

    for (const msg of messages) {
      const row = document.createElement('div');
      row.style.cssText = `display: flex; flex-direction: column; align-items: ${msg.isOwn ? 'flex-end' : 'flex-start'}; margin-bottom: 8px;`;

      const bubble = document.createElement('div');
      bubble.style.cssText = [
        `background: ${msg.isOwn ? 'var(--tmx-accent-blue, #3273dc)' : 'var(--chc-bg-secondary, #f0f0f0)'}`,
        `color: ${msg.isOwn ? '#fff' : 'var(--chc-text-primary, #333)'}`,
        'padding: 6px 12px',
        'border-radius: 12px',
        'max-width: 85%',
        'word-break: break-word',
        'font-size: 0.9rem',
      ].join('; ');
      bubble.textContent = msg.message;

      const meta = document.createElement('div');
      meta.style.cssText = 'font-size: 0.7rem; color: var(--chc-text-secondary, #888); margin-top: 2px; padding: 0 4px;';
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      meta.textContent = msg.isOwn ? time : `${msg.userName} \u00b7 ${time}`;

      row.appendChild(bubble);
      row.appendChild(meta);
      messagesContainer.appendChild(row);
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  const handleSend = () => {
    const text = input?.value;
    if (!text?.trim()) return;
    sendMessage(text);
    input.value = '';
    input.focus();
  };

  // Restore saved position if there is one and it's still on screen;
  // otherwise fall back to "near the chat icon" for first-time users.
  const savedPosition = loadPanelPosition();
  const positionStyles: string[] = [];
  if (savedPosition) {
    const clamped = clampPosition(savedPosition);
    positionStyles.push(`left: ${clamped.left}px`, `top: ${clamped.top}px`);
  } else {
    const chatIcon = document.getElementById('chatIndicator');
    const iconRect = chatIcon?.getBoundingClientRect();
    const topPos = iconRect ? `${iconRect.bottom + 8}px` : '60px';
    const rightPos = iconRect ? `${window.innerWidth - iconRect.right}px` : '16px';
    positionStyles.push(`top: ${topPos}`, `right: ${rightPos}`);
  }

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = [
    'position: fixed',
    ...positionStyles,
    `width: ${PANEL_WIDTH}px`,
    'max-height: 480px',
    'display: flex',
    'flex-direction: column',
    'background: var(--chc-bg-primary, #fff)',
    'border: 1px solid var(--chc-border-primary, #ddd)',
    'border-radius: 12px',
    'box-shadow: 0 4px 24px rgba(0,0,0,0.15)',
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
    'cursor: move',
  ].join('; ');

  // Make header draggable
  enableDrag(header, panel);

  const titleGroup = document.createElement('div');
  titleGroup.style.cssText = 'display: flex; align-items: center; gap: 8px; min-width: 0;';

  const title = document.createElement('span');
  title.textContent = 'Tournament Chat';
  title.style.cssText = 'font-weight: 600; font-size: 0.9rem; user-select: none;';

  presenceLabel = document.createElement('span');
  presenceLabel.style.cssText = [
    'display: none',
    'align-items: center',
    'gap: 4px',
    'font-size: 0.72rem',
    'color: var(--chc-text-secondary, #6b7280)',
    'background: var(--chc-bg-primary, #fff)',
    'border: 1px solid var(--chc-border-primary, #e5e7eb)',
    'border-radius: 999px',
    'padding: 1px 8px',
    'user-select: none',
  ].join('; ');
  const presenceIcon = document.createElement('i');
  presenceIcon.className = 'fa-solid fa-user-group';
  presenceIcon.style.cssText = 'font-size: 0.65rem;';
  const presenceCount = document.createElement('span');
  presenceCount.textContent = '0';
  presenceLabel.appendChild(presenceIcon);
  presenceLabel.appendChild(presenceCount);

  titleGroup.appendChild(title);
  titleGroup.appendChild(presenceLabel);

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--chc-text-secondary, #888); line-height: 1;';
  closeBtn.onclick = closeChatPanel;

  header.appendChild(titleGroup);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Messages area
  messagesContainer = document.createElement('div');
  messagesContainer.style.cssText = [
    'flex: 1',
    'overflow-y: auto',
    'padding: 8px',
    'min-height: 200px',
    'max-height: 340px',
  ].join('; ');
  panel.appendChild(messagesContainer);

  // Input row
  const inputRow = document.createElement('div');
  inputRow.style.cssText = 'display: flex; gap: 6px; padding: 8px; border-top: 1px solid var(--chc-border-primary, #ddd);';

  input = document.createElement('input');
  input.type = 'text';
  input.className = 'input is-small';
  input.placeholder = 'Type a message...';
  input.style.cssText = 'flex: 1;';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  const sendBtn = document.createElement('button');
  sendBtn.className = 'button is-primary is-small';
  sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
  sendBtn.onclick = handleSend;

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  panel.appendChild(inputRow);

  document.body.appendChild(panel);

  renderMessages();
  renderPresence();
  unsubscribe = onChatUpdate(() => {
    renderMessages();
    renderPresence();
  });
  requestAnimationFrame(() => input.focus());
}

function closeChatPanel(): void {
  setChatModalOpen(false);
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = undefined;
  }
  const el = document.getElementById(PANEL_ID);
  if (el) el.remove();
}

function enableDrag(handle: HTMLElement, panel: HTMLElement): void {
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const onMouseMove = (e: MouseEvent) => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    panel.style.left = `${startLeft + dx}px`;
    panel.style.top = `${startTop + dy}px`;
    panel.style.right = 'auto';
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    // Save the panel's final on-screen position so the next open lands
    // where the user left it.
    const rect = panel.getBoundingClientRect();
    savePanelPosition({ left: rect.left, top: rect.top });
  };

  handle.addEventListener('mousedown', (e) => {
    // Don't drag if clicking the close button
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

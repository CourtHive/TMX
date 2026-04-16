/**
 * "Ask TMX" assistant panel.
 * Floating panel for AI-powered tournament help.
 * Communicates with tmx-assistant service via REST + SSE.
 */
import { tournamentEngine } from 'tods-competition-factory';
import { serverConfig } from 'config/serverConfig';
import { getToken } from 'services/authentication/tokenManagement';

const PANEL_ID = 'assistantPanel';
const MAX_HISTORY = 50;

interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** Server-assigned ID for assistant messages — used to attach feedback */
  id?: string;
  feedbackScore?: 1 | -1;
}

let conversationId: string | undefined;
let messages: AssistantMessage[] = [];
let isStreaming = false;

// --- Rendering helpers ---

function buildMessageBubble(msg: AssistantMessage): HTMLElement {
  const isUser = msg.role === 'user';
  const bubble = document.createElement('div');
  bubble.style.cssText = [
    `background: ${isUser ? 'var(--tmx-accent-blue, #3273dc)' : 'var(--chc-bg-secondary, #f0f0f0)'}`,
    `color: ${isUser ? '#fff' : 'var(--chc-text-primary, #333)'}`,
    'padding: 8px 14px',
    'border-radius: 12px',
    'max-width: 90%',
    'word-break: break-word',
    'font-size: 0.875rem',
    'line-height: 1.5',
    'white-space: pre-wrap',
  ].join('; ');
  bubble.textContent = msg.content;
  return bubble;
}

function buildAssistantLabel(): HTMLElement {
  const label = document.createElement('div');
  label.style.cssText =
    'font-size: 0.7rem; color: var(--chc-text-secondary, #888); margin-bottom: 2px; font-weight: 600;';
  label.textContent = 'TMX Assistant';
  return label;
}

function buildFeedbackButton(
  msg: AssistantMessage,
  score: 1 | -1,
  icon: string,
  title: string,
  onFeedback: (msg: AssistantMessage, score: 1 | -1) => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  const active = msg.feedbackScore === score;
  const activeColor = score === 1 ? 'var(--tmx-accent-green, #48c774)' : 'var(--tmx-accent-red, #f14668)';
  btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
  btn.title = title;
  btn.style.cssText = [
    'background: none',
    'border: none',
    'cursor: pointer',
    `color: ${active ? activeColor : 'var(--chc-text-secondary, #888)'}`,
    'font-size: 0.8rem',
    'padding: 2px 6px',
    `opacity: ${active ? '1' : '0.6'}`,
  ].join('; ');
  btn.onclick = () => onFeedback(msg, score);
  return btn;
}

function buildFeedbackRow(
  msg: AssistantMessage,
  onFeedback: (msg: AssistantMessage, score: 1 | -1) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; gap: 6px; margin-top: 4px; padding: 0 4px; align-items: center;';
  row.appendChild(buildFeedbackButton(msg, 1, 'fa-thumbs-up', 'Helpful', onFeedback));
  row.appendChild(buildFeedbackButton(msg, -1, 'fa-thumbs-down', 'Not helpful', onFeedback));
  return row;
}

function buildMessageRow(
  msg: AssistantMessage,
  onFeedback: (msg: AssistantMessage, score: 1 | -1) => void,
): HTMLElement {
  const row = document.createElement('div');
  const align = msg.role === 'user' ? 'flex-end' : 'flex-start';
  row.style.cssText = `display: flex; flex-direction: column; align-items: ${align}; margin-bottom: 10px;`;

  if (msg.role !== 'user') row.appendChild(buildAssistantLabel());
  row.appendChild(buildMessageBubble(msg));
  if (msg.role !== 'user' && msg.id) row.appendChild(buildFeedbackRow(msg, onFeedback));

  return row;
}

// --- SSE stream parsing ---

interface StreamChunkHandler {
  onContent: (delta: string) => void;
  onConversationId: (id: string) => void;
  onAssistantMessageId: (id: string) => void;
}

function processSseLine(line: string, handlers: StreamChunkHandler): void {
  if (!line.startsWith('data: ')) return;
  try {
    const data = JSON.parse(line.slice(6));
    if (data.content) handlers.onContent(data.content);
    if (data.conversationId) handlers.onConversationId(data.conversationId);
    if (data.assistantMessageId) handlers.onAssistantMessageId(data.assistantMessageId);
  } catch {
    // skip malformed SSE lines
  }
}

async function consumeSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: StreamChunkHandler,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) processSseLine(line, handlers);
  }
}

export function openAssistantPanel(): void {
  if (document.getElementById(PANEL_ID)) {
    closeAssistantPanel();
    return;
  }

  let messagesContainer: HTMLElement;
  let input: HTMLTextAreaElement;
  let sendBtn: HTMLButtonElement;

  const renderMessages = () => {
    if (!messagesContainer) return;
    messagesContainer.innerHTML = '';
    for (const msg of messages) {
      messagesContainer.appendChild(buildMessageRow(msg, sendFeedback));
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  const sendFeedback = async (msg: AssistantMessage, score: 1 | -1) => {
    if (!msg.id || msg.feedbackScore === score) return; // no-op if already voted same way
    const previousScore = msg.feedbackScore;
    msg.feedbackScore = score;
    renderMessages();

    const { assistantUrl } = serverConfig.get();
    const token = getToken();
    try {
      const response = await fetch(`${assistantUrl}/api/messages/${msg.id}/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ score }),
      });
      if (!response.ok) {
        msg.feedbackScore = previousScore; // revert optimistic update
        renderMessages();
      }
    } catch {
      msg.feedbackScore = previousScore;
      renderMessages();
    }
  };

  const setInputState = (streaming: boolean) => {
    isStreaming = streaming;
    if (sendBtn) {
      sendBtn.disabled = streaming;
      sendBtn.innerHTML = streaming
        ? '<i class="fa-solid fa-spinner fa-spin"></i>'
        : '<i class="fa-solid fa-paper-plane"></i>';
    }
    if (input) input.disabled = streaming;
  };

  const handleSend = async () => {
    const text = input?.value?.trim();
    if (!text || isStreaming) return;

    const userMsg: AssistantMessage = { role: 'user', content: text, timestamp: Date.now() };
    messages.push(userMsg);
    if (messages.length > MAX_HISTORY) messages = messages.slice(-MAX_HISTORY);
    input.value = '';
    input.style.height = 'auto';
    renderMessages();

    setInputState(true);

    const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
    const { assistantUrl } = serverConfig.get();
    const token = getToken();

    try {
      const response = await fetch(`${assistantUrl}/api/ask`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: text, tournamentId, conversationId }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const assistantMsg: AssistantMessage = { role: 'assistant', content: '', timestamp: Date.now() };
      messages.push(assistantMsg);
      renderMessages();

      let assistantContent = '';
      const updateLastBubble = () => {
        const bubbles = messagesContainer.querySelectorAll('div > div:not([style*="font-weight"])');
        const lastBubble = bubbles[bubbles.length - 1] as HTMLElement | undefined;
        if (lastBubble) {
          lastBubble.textContent = assistantContent;
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      };

      await consumeSseStream(reader, {
        onContent: (delta) => {
          assistantContent += delta;
          assistantMsg.content = assistantContent;
          updateLastBubble();
        },
        onConversationId: (id) => {
          conversationId = id;
        },
        onAssistantMessageId: (id) => {
          assistantMsg.id = id;
        },
      });
    } catch (err) {
      const errorMsg: AssistantMessage = {
        role: 'assistant',
        content: `Sorry, I couldn't process that request. ${err instanceof Error ? err.message : 'Please try again.'}`,
        timestamp: Date.now(),
      };
      messages.push(errorMsg);
    }

    setInputState(false);
    renderMessages();
    input?.focus();
  };

  // Position near whichever assistant icon is currently visible
  const candidates = [
    document.getElementById('assistantIndicator'),
    document.getElementById('assistantIndicatorHome'),
  ];
  const assistantIcon = candidates.find((el) => el && el.offsetParent !== null) ?? candidates[0];
  const iconRect = assistantIcon?.getBoundingClientRect();
  const topPos = iconRect ? `${iconRect.bottom + 8}px` : '60px';
  const rightPos = iconRect ? `${globalThis.innerWidth - iconRect.right}px` : '16px';

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = [
    'position: fixed',
    `top: ${topPos}`,
    `right: ${rightPos}`,
    'width: 380px',
    'max-height: 560px',
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
    'background: var(--tmx-accent-blue, #3273dc)',
    'color: #fff',
    'cursor: move',
  ].join('; ');

  enableDrag(header, panel);

  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'display: flex; align-items: center; gap: 8px; user-select: none;';
  titleRow.innerHTML = '<i class="fa-solid fa-robot"></i>';
  const titleText = document.createElement('span');
  titleText.textContent = 'Ask TMX';
  titleText.style.fontWeight = '600';
  titleRow.appendChild(titleText);

  const headerActions = document.createElement('div');
  headerActions.style.cssText = 'display: flex; gap: 8px; align-items: center;';

  const newBtn = document.createElement('button');
  newBtn.title = 'New conversation';
  newBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
  newBtn.style.cssText = 'background: none; border: none; color: #fff; cursor: pointer; font-size: 0.9rem; opacity: 0.8;';
  newBtn.onclick = (e) => {
    e.stopPropagation();
    conversationId = undefined;
    messages = [];
    renderMessages();
    input?.focus();
  };

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'background: none; border: none; font-size: 1.3rem; cursor: pointer; color: #fff; line-height: 1; opacity: 0.8;';
  closeBtn.onclick = closeAssistantPanel;

  headerActions.appendChild(newBtn);
  headerActions.appendChild(closeBtn);

  header.appendChild(titleRow);
  header.appendChild(headerActions);
  panel.appendChild(header);

  // Messages area
  messagesContainer = document.createElement('div');
  messagesContainer.style.cssText = [
    'flex: 1',
    'overflow-y: auto',
    'padding: 12px',
    'min-height: 240px',
    'max-height: 400px',
  ].join('; ');

  // Welcome message if empty
  if (messages.length === 0) {
    const welcome = document.createElement('div');
    welcome.style.cssText = 'text-align: center; padding: 40px 20px; color: var(--chc-text-secondary, #888); font-size: 0.875rem;';
    welcome.innerHTML = `
      <i class="fa-solid fa-robot" style="font-size: 2rem; margin-bottom: 12px; display: block; opacity: 0.4;"></i>
      <div style="font-weight: 600; margin-bottom: 4px;">How can I help?</div>
      <div>Ask about draws, scheduling, scoring, or anything TMX.</div>
    `;
    messagesContainer.appendChild(welcome);
  }

  panel.appendChild(messagesContainer);

  // Input row
  const inputRow = document.createElement('div');
  inputRow.style.cssText = 'display: flex; gap: 6px; padding: 8px 12px; border-top: 1px solid var(--chc-border-primary, #ddd); align-items: flex-end;';

  input = document.createElement('textarea');
  input.className = 'input is-small';
  input.placeholder = 'Ask a question...';
  input.rows = 1;
  input.style.cssText = 'flex: 1; resize: none; min-height: 34px; max-height: 100px; font-family: inherit; padding: 6px 10px;';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 100)}px`;
  });

  sendBtn = document.createElement('button');
  sendBtn.className = 'button is-primary is-small';
  sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
  sendBtn.style.cssText = 'height: 34px; width: 34px; padding: 0;';
  sendBtn.onclick = handleSend;

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  panel.appendChild(inputRow);

  document.body.appendChild(panel);

  if (messages.length > 0) renderMessages();
  requestAnimationFrame(() => input.focus());
}

function closeAssistantPanel(): void {
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
  };

  handle.addEventListener('mousedown', (e) => {
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

/**
 * Check if the assistant service is reachable.
 * Returns true if the service is healthy, false otherwise.
 */
export async function checkAssistantHealth(): Promise<boolean> {
  const { assistantUrl } = serverConfig.get();
  if (!assistantUrl) return false;

  try {
    const response = await fetch(`${assistantUrl}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

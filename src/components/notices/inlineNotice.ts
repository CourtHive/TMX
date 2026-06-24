/**
 * Inline notice — a persistent, dismissible in-page banner, distinct from the
 * ephemeral corner toast (`tmxToast`). Use it when the user needs to read a
 * reason after the fact (e.g. "some changes could not be saved because…")
 * rather than a fleeting confirmation.
 *
 * Theme-aware: every colour derives from `--tmx-*` tokens that are defined for
 * both light and dark themes, so the banner never hardcodes a light-mode look.
 * Returns the element; the caller mounts it (typically prepended into a page
 * container) and removes it on the next render or via the dismiss control.
 */
import { t } from 'i18n';

export type InlineNoticeIntent = 'warning' | 'info' | 'danger';

const INTENT_TOKENS: Record<InlineNoticeIntent, { bg: string; border: string; accent: string }> = {
  warning: {
    bg: 'var(--tmx-panel-yellow-bg, rgba(245,158,11,0.08))',
    border: 'var(--tmx-panel-yellow-border, #f59e0b)',
    accent: 'var(--tmx-accent-orange, #f59e0b)',
  },
  info: {
    bg: 'var(--tmx-bg-secondary, rgba(59,130,246,0.08))',
    border: 'var(--tmx-accent-blue, #3b82f6)',
    accent: 'var(--tmx-accent-blue, #3b82f6)',
  },
  danger: {
    bg: 'var(--tmx-bg-secondary, rgba(239,68,68,0.08))',
    border: 'var(--tmx-accent-red, #ef4444)',
    accent: 'var(--tmx-accent-red, #ef4444)',
  },
};

const INTENT_ICON: Record<InlineNoticeIntent, string> = {
  warning: 'fa-triangle-exclamation',
  info: 'fa-circle-info',
  danger: 'fa-circle-exclamation',
};

export function buildInlineNotice(opts: {
  message: string;
  intent?: InlineNoticeIntent;
  /** When provided, a dismiss (×) control is rendered that invokes this. */
  onDismiss?: () => void;
}): HTMLElement {
  const intent = opts.intent ?? 'warning';
  const tokens = INTENT_TOKENS[intent];

  const banner = document.createElement('div');
  banner.setAttribute('role', 'status');
  banner.style.cssText = [
    'display: flex',
    'align-items: center',
    'gap: 10px',
    'margin: 8px 0',
    'padding: 10px 14px',
    'border-radius: 6px',
    `background: ${tokens.bg}`,
    `border: 1px solid ${tokens.border}`,
    'color: var(--tmx-text-primary)',
    'font-size: 0.85rem',
  ].join('; ');

  const icon = document.createElement('i');
  icon.className = `fa-solid ${INTENT_ICON[intent]}`;
  icon.style.color = tokens.accent;
  banner.appendChild(icon);

  const message = document.createElement('span');
  message.style.flex = '1';
  message.textContent = opts.message;
  banner.appendChild(message);

  if (opts.onDismiss) {
    const dismiss = document.createElement('button');
    dismiss.setAttribute('aria-label', t('common.dismiss', { defaultValue: 'Dismiss' }));
    dismiss.style.cssText =
      'background: none; border: none; cursor: pointer; color: var(--tmx-text-muted, #888); font-size: 1rem; line-height: 1; padding: 2px;';
    dismiss.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    dismiss.addEventListener('click', () => opts.onDismiss?.());
    banner.appendChild(dismiss);
  }

  return banner;
}

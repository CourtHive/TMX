/**
 * Schedule 2 — Profile View (placeholder)
 *
 * Will integrate the courthive-components Scheduling Profile for round-level
 * scheduling (rounds → dates/venues). For now renders a placeholder.
 */

let container: HTMLElement | null = null;

export function renderProfileView(target: HTMLElement): void {
  container = target;

  const placeholder = document.createElement('div');
  placeholder.style.cssText =
    'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; gap: 16px; color: var(--tmx-muted);';

  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-layer-group';
  icon.style.cssText = 'font-size: 48px; opacity: 0.3;';
  placeholder.appendChild(icon);

  const title = document.createElement('div');
  title.style.cssText = 'font-size: 16px; font-weight: 600;';
  title.textContent = 'Scheduling Profile';
  placeholder.appendChild(title);

  const desc = document.createElement('div');
  desc.style.cssText = 'font-size: 13px; max-width: 400px; text-align: center; line-height: 1.5;';
  desc.textContent =
    'Plan which rounds play on which dates and venues. Drag rounds to venue lanes, validate precedence rules, and set "Not Before" times.';
  placeholder.appendChild(desc);

  const badge = document.createElement('div');
  badge.style.cssText =
    'font-size: 11px; padding: 4px 12px; border-radius: 12px; background: rgba(59, 130, 246, 0.1); color: var(--tmx-accent-blue);';
  badge.textContent = 'Coming in Phase 2';
  placeholder.appendChild(badge);

  target.appendChild(placeholder);
}

export function destroyProfileView(): void {
  if (container) {
    container.innerHTML = '';
    container = null;
  }
}

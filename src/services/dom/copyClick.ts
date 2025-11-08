/**
 * Copy text to clipboard with fallback support.
 * Uses modern clipboard API with legacy execCommand fallback.
 */
import { tmxToast } from 'services/notifications/tmxToast';

export function copyClick(message: string): void {
  navigator.clipboard
    .writeText(message)
    .then(() => tmxToast({ message: `Copied to clipboard`, intent: 'is-success' }))
    .catch((err) => tmxToast({ message: err, intent: 'is-danger' }));

  const c = document.createElement('input');
  c.style.opacity = '0';
  c.setAttribute('id', 'c2c');
  c.setAttribute('type', 'text');
  c.setAttribute('value', message);
  const inp = document.body.appendChild(c);

  const b = document.createElement('button');
  b.style.display = 'none';
  b.setAttribute('data-copytarget', '#c2c');
  b.addEventListener('click', elementCopy, true);
  const elem = document.body.appendChild(b);
  elem.click();
  elem.remove();
  inp.remove();
}

function elementCopy(e: Event): void {
  const t = e.target as HTMLElement;
  const c = t.dataset.copytarget;
  const inp = c ? (document.querySelector(c) as HTMLInputElement) : null;

  if (inp?.select) {
    inp.select();

    try {
      document.execCommand('copy');
      inp.blur();
    } catch (err) {
      alert('please press Ctrl/Cmd+C to copy');
    }
  }
}

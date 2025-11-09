/**
 * Copy text to clipboard using modern clipboard API.
 */
import { tmxToast } from 'services/notifications/tmxToast';

export async function copyClick(message: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(message);
    tmxToast({ message: `Copied to clipboard`, intent: 'is-success' });
  } catch (err) {
    tmxToast({ message: String(err), intent: 'is-danger' });
  }
}

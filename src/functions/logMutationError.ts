/**
 * Unified error handler for mutation results.
 * Logs to console for debugging and optionally shows a toast to the user.
 */
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

import type { ExecutionResult } from 'types/services';

export function logMutationError(
  context: string,
  result: ExecutionResult,
  options?: { toast?: boolean; message?: string },
): void {
  const message = options?.message || result.error?.message || t('common.error');
  console.error(`[${context}]`, result.error);
  if (options?.toast !== false) {
    tmxToast({ message, intent: 'is-danger' });
  }
}

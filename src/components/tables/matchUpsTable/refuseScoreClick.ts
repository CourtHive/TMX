import { MATCHUP_STATUS_DISPLAY } from '../common/formatters/matchUpStatusDisplay';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

/**
 * A click the factory gives no SCORE action for. A cell that shows a score or an outcome looks like it
 * can be corrected, so it says why nothing opens; an empty cell advertised nothing and stays quiet.
 */
export function refuseScoreClick(data: any): void {
  const shown = data?.score || MATCHUP_STATUS_DISPLAY[data?.matchUp?.matchUpStatus];
  if (shown) tmxToast({ message: t('toasts.scoreRefused'), intent: 'is-warning' });
}

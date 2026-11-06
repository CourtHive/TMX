/**
 * Download a dual's StatCrew XML (see `statCrewExport`), with a toast saying how it went.
 */
import { STATCREW_AMBIGUOUS, STATCREW_NOT_COMPLETE, statCrewExport } from './statCrew';
import { tmxToast } from 'services/notifications/tmxToast';
import { downloadXML } from './download';
import { t } from 'i18n';

const FAILURE_KEYS: Record<string, string> = {
  [STATCREW_NOT_COMPLETE]: 'overlays.scorecard.statCrewNotComplete',
  [STATCREW_AMBIGUOUS]: 'overlays.scorecard.statCrewAmbiguous',
};

export async function exportStatCrew({ drawId, matchUpId }: { drawId: string; matchUpId: string }): Promise<void> {
  const result = statCrewExport({ drawId, matchUpId });
  if ('error' in result) {
    tmxToast({ message: t(FAILURE_KEYS[result.error] ?? 'overlays.scorecard.statCrewFailed'), intent: 'is-warning' });
    return;
  }
  // no success toast: a native save dialog can be cancelled, and that is not reported back
  await downloadXML(result.filename, result.content);
}

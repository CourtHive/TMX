/**
 * Tell the director what became of a durable save that did not succeed (durableSave.ts). Kept apart
 * from durableSave so that module stays free of the DOM and testable in the node environment.
 *
 * The local copy is never touched here. A conflict offers the existing way to load the server's copy
 * (the stale sync indicator and its refresh); loading it is always the director's explicit choice.
 */
import { markStaleNeedsRefresh, refreshTournamentFromServer } from 'services/messaging/remoteMutations';
import { tmxToast } from 'services/notifications/tmxToast';
import { reportErrorResponse } from './baseApi';
import { t } from 'i18n';

import type { DurableSaveResult, SaveFlow } from './durableSave';

export function reportSaveOutcome(result: DurableSaveResult, flow: SaveFlow, tournamentId: string): void {
  if (result.status === 'saved') return;

  if (result.status === 'conflict') {
    // create / claim expected no record at all: the one there is another tournament, not a newer
    // version of this copy. An upload is from an online copy that is now known to be behind, which
    // is what the stale indicator is for (it also blocks edits until the copy is refreshed). An
    // offline copy that failed to go online stays editable offline: refreshing it would discard the
    // offline work, so that is only offered, and repeating "go online" offers it again.
    const replacesCopy = flow === 'goOnline' || flow === 'upload';
    if (flow === 'upload') markStaleNeedsRefresh(tournamentId);
    tmxToast({
      message: t(replacesCopy ? 'modals.tournamentActions.saveConflict' : 'modals.tournamentActions.saveExists'),
      intent: 'is-warning',
      pauseOnHover: true,
      duration: 10000,
      ...(flow !== 'create' && {
        action: {
          text: t('modals.tournamentActions.loadServerCopy'),
          onClick: () => refreshTournamentFromServer(tournamentId),
        },
      }),
    });
    return;
  }

  if (result.status === 'uncertain') {
    tmxToast({ message: t('modals.tournamentActions.saveUncertain'), intent: 'is-danger', duration: 8000 });
    return;
  }

  reportErrorResponse(result.data);
}

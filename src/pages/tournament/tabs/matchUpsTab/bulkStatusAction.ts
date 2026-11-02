/**
 * "Set status" on the matchUps table's selection overlay: one no-score status (ABANDONED, CANCELLED, DOUBLE_WALKOVER)
 * on every selected row at once, for a weather day.
 *
 * Every row is asked of the factory before anything is sent (`precheckBulkMatchUpStatus`). If any row would be
 * refused, the batch is refused and the director is shown which rows and why; otherwise a confirmation lists the
 * matchUps and the batch goes as one `bulkMatchUpStatusUpdate`.
 *
 * Hidden where the caller could not run it: a provider that does not allow scoring, and an assignment that limits the
 * caller to scoring single matchUps (a SCORER may run only `setMatchUpStatus`) or to nothing.
 */
import { describeBulkRow, precheckBulkMatchUpStatus } from 'services/transitions/bulkMatchUpStatus';
import { confirmModal, informModal } from 'components/modals/baseModal/baseModal';
import { isScoringOnlyAssignment } from 'services/capability/assignmentRole';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { cannot } from 'services/capability/can';
import { OVERLAY } from 'constants/tmxConstants';
import { t } from 'i18n';

// constants and types
import { BULK_MATCHUP_STATUSES, type BulkRefusal, type BulkStatusRow } from 'services/transitions/bulkMatchUpStatus';

const STATUS_LABEL_KEYS: Record<string, string> = {
  ABANDONED: 'modals.scoring.abandoned',
  CANCELLED: 'modals.scoring.cancelled',
  DOUBLE_WALKOVER: 'modals.scoreEntry.doubleWalkover',
};

const statusLabel = (matchUpStatus: string): string => t(STATUS_LABEL_KEYS[matchUpStatus] ?? matchUpStatus);

function listElement(intro: string, lines: string[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;font-size:0.875rem;';
  const summary = document.createElement('div');
  summary.textContent = intro;
  const list = document.createElement('ul');
  list.style.cssText = 'margin:0;padding-left:1.25rem;max-height:16rem;overflow-y:auto;';
  for (const line of lines) {
    const item = document.createElement('li');
    item.textContent = line;
    list.appendChild(item);
  }
  wrap.append(summary, list);
  return wrap;
}

function refusalReason(refusal: BulkRefusal, matchUpStatus: string): string {
  if (refusal.reason === 'notScorable') return t('matchUpsActions.bulkStatus.notScorable');
  if (refusal.reason === 'statusDisabled') {
    return t('modals.scoring.statusUnavailable', { status: statusLabel(matchUpStatus) });
  }
  return refusal.message ?? t('matchUpsActions.bulkStatus.refusedByFactory');
}

function refusalLine(refusal: BulkRefusal, matchUpStatus: string): string {
  return `${describeBulkRow(refusal.row)} — ${refusalReason(refusal, matchUpStatus)}`;
}

function setSelectedStatus(table: any, matchUpStatus: string, onDone: () => void): void {
  const rows: BulkStatusRow[] = table.getSelectedData();
  if (!rows.length) return;

  const precheck = precheckBulkMatchUpStatus({ matchUpStatus, rows });
  const status = statusLabel(matchUpStatus);

  if (!precheck.methods) {
    informModal({
      title: t('matchUpsActions.bulkStatus.refusedTitle', { status }),
      message: listElement(
        t('matchUpsActions.bulkStatus.refusedExplain', { count: precheck.refusals.length }),
        precheck.refusals.map((refusal) => refusalLine(refusal, matchUpStatus)),
      ),
      okAction: undefined,
    });
    return;
  }

  const methods = precheck.methods;
  confirmModal({
    title: t('matchUpsActions.bulkStatus.confirmTitle', { status }),
    query: listElement(
      t('matchUpsActions.bulkStatus.confirmExplain', { count: rows.length, status }),
      rows.map(describeBulkRow),
    ),
    okIntent: 'is-danger',
    okAction: () =>
      mutationRequest({
        methods,
        callback: (result: any) => {
          if (result?.error) return;
          tmxToast({
            message: t('matchUpsActions.bulkStatus.applied', { count: rows.length, status }),
            intent: 'is-success',
          });
          table.deselectRow();
          onDone();
        },
      }),
  });
}

/** The selection-overlay item; hidden where the caller could not run the batch. */
export function getBulkStatusItem(table: any, replaceTableData: () => void): any {
  const tournamentRecord = tournamentEngine.getTournament()?.tournamentRecord;
  return {
    options: BULK_MATCHUP_STATUSES.map((matchUpStatus) => ({
      onClick: () => setSelectedStatus(table, matchUpStatus, replaceTableData),
      label: statusLabel(matchUpStatus),
      close: true,
    })),
    label: t('matchUpsActions.bulkStatus.label'),
    hide: cannot('enterScores') || isScoringOnlyAssignment(tournamentRecord),
    intent: 'is-warning',
    location: OVERLAY,
  };
}

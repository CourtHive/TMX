/**
 * Record a WALKOVER or DEFAULTED on a matchUp before its second opponent arrives (CA, 2026-10-04).
 *
 * The participant already there is ill, injured, or defaulted for conduct between matches. The factory
 * offers this as the `EXIT` matchUp action — SCORE needs two participants — with a payload that already
 * awards the EMPTY side; whoever arrives there takes the walkover. Reason codes come from the event's
 * scoring policy, as in the scoring modal, and are omitted when none is chosen (an empty array would blank
 * the codes).
 */
import { closeModal, openModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { policyConstants } from 'tods-competition-factory';
import { renderForm } from 'courthive-components';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';

const { POLICY_TYPE_SCORING } = policyConstants;
const EXIT_ACTION = 'EXIT';
const SEPARATOR = '|';

/** The EXIT action the factory offers for this matchUp, or undefined where it offers none. */
export function exitBeforeArrivalAction({ matchUpId, drawId }: { matchUpId: string; drawId: string }): any {
  const { validActions } = tournamentEngine.matchUpActions({ matchUpId, drawId }) || {};
  return validActions?.find(({ type }: any) => type === EXIT_ACTION);
}

function reasonCodes(eventId: string | undefined, matchUpStatus: string): any[] {
  if (!eventId) return [];
  const scoringPolicy: any = tournamentEngine.findPolicy({ policyType: POLICY_TYPE_SCORING, eventId });
  const group = scoringPolicy?.policy?.matchUpStatusCodes?.[matchUpStatus];
  return Array.isArray(group) ? group.filter((entry: any) => entry?.matchUpStatusCode) : [];
}

function statusLabel(matchUpStatus: string): string {
  return matchUpStatus === 'DEFAULTED' ? t('scoring.default') : t('scoring.walkover');
}

export function recordExitBeforeArrival({
  action,
  matchUp,
  callback,
}: {
  action: any;
  matchUp: any;
  callback?: (result: any) => void;
}): void {
  const { payload } = action;
  const exiting = matchUp?.sides?.find((side: any) => side.sideNumber === payload.exitingSideNumber);
  const name = exiting?.participant?.participantName ?? '';

  const options = (payload.matchUpStatuses as string[]).flatMap((matchUpStatus) => [
    { label: statusLabel(matchUpStatus), value: matchUpStatus },
    ...reasonCodes(matchUp?.eventId, matchUpStatus).map((entry: any) => ({
      label: `${statusLabel(matchUpStatus)} — ${entry.matchUpStatusCodeDisplay || entry.label || entry.matchUpStatusCode}`,
      value: `${matchUpStatus}${SEPARATOR}${entry.matchUpStatusCode}`,
    })),
  ]);

  const content = (elem: HTMLElement) => {
    const prompt = document.createElement('p');
    prompt.textContent = t('modals.exitBeforeArrival.prompt', { name });
    prompt.style.marginBottom = '1em';
    elem.appendChild(prompt);
    const formHolder = document.createElement('div');
    elem.appendChild(formHolder);
    // until the opponent arrives a recorded exit can be changed (CA, 2026-10-04): start from what stands
    const recorded = payload.recorded;
    const current = recorded?.matchUpStatusCode
      ? `${recorded.matchUpStatus}${SEPARATOR}${recorded.matchUpStatusCode}`
      : recorded?.matchUpStatus;
    const value = options.some((option) => option.value === current) ? current : options[0]?.value;
    return renderForm(formHolder, [{ value, label: '', field: 'exit', options }]);
  };

  const send = (outcome: any) => {
    // only the fields setMatchUpStatus reads travel; the action's descriptive fields stay behind
    const params = { drawId: payload.drawId, matchUpId: payload.matchUpId, outcome };
    const methods = [{ method: SET_MATCHUP_STATUS, params }];
    mutationRequest({
      methods,
      callback: (result: any) => {
        if (result?.error) tmxToast({ message: result.error.message ?? t('common.error'), intent: 'is-danger' });
        else closeModal();
        isFunction(callback) && callback(result);
      },
    });
  };

  const submit = ({ content }: any) => {
    const [matchUpStatus, matchUpStatusCode] = String(content?.exit?.value ?? '').split(SEPARATOR);
    if (!matchUpStatus) return;
    send({
      ...payload.outcome,
      matchUpStatus,
      ...(matchUpStatusCode ? { matchUpStatusCodes: [matchUpStatusCode] } : {}),
    });
  };

  // until the opponent arrives a recorded exit can also be cleared — the outcome CLEAR_SCORE carries
  const clear = () => send({ matchUpStatus: 'TO_BE_PLAYED', score: { scoreStringSide1: '', scoreStringSide2: '' } });

  openModal({
    title: t('modals.exitBeforeArrival.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      ...(payload.recorded
        ? [{ label: t('modals.exitBeforeArrival.clear'), intent: 'is-warning', onClick: clear }]
        : []),
      { label: t('modals.exitBeforeArrival.exit'), intent: 'is-danger', onClick: submit as any },
    ],
  });
}

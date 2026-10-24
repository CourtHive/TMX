import { GENERATE_ROTATING_PARTNER_ROUND } from 'constants/mutationConstants';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { randomId } from 'functions/randomId';
import { cModal } from 'courthive-components';
import { t } from 'i18n';

const WARNING_INTENT = 'is-warning';

export function isConfiguredRotatingDraw(drawId: string): boolean {
  const { drawDefinition } = tournamentEngine.getEvent({ drawId });
  return ['AMERICANO', 'MEXICANO'].includes(drawDefinition?.competitionProfile?.format ?? '');
}

export function previewRotatingRound({
  drawId,
  structure,
  callback,
}: {
  drawId: string;
  structure: any;
  callback?: () => void;
}): void {
  // Menu callbacks capture a structure summary, which may omit matchUps or predate an applied round.
  // Read the draw's current matchUps, as the factory does when enforcing the next logical round.
  const { matchUps, error } = tournamentEngine.allDrawMatchUps({ drawId });
  if (error || !matchUps) {
    tmxToast({ message: String(error?.message ?? t('rotatingPartners.creation.configError')), intent: WARNING_INTENT });
    return;
  }
  const roundNumber = matchUps.reduce((last, matchUp) => Math.max(last, matchUp.roundNumber ?? 0), 0) + 1;
  const preview = tournamentEngine.getRotatingPartnerRoundPreview({
    drawId,
    structureId: structure.structureId,
    roundNumber,
  });
  if (preview.error || !preview.round || !preview.scoringContract) {
    tmxToast({
      message: String(preview.info ?? preview.error?.message ?? t('rotatingPartners.creation.configError')),
      intent: WARNING_INTENT,
    });
    return;
  }
  const participants = tournamentEngine.getTournament().tournamentRecord?.participants ?? [];
  const names = new Map(participants.map((participant) => [participant.participantId, participant.participantName]));
  const content = document.createElement('div');
  for (const pairings of preview.round) {
    const row = document.createElement('p');
    row.textContent = pairings.map((side) => side.map((id) => names.get(id) ?? id).join(' / ')).join(' — ');
    content.appendChild(row);
  }
  const method = {
    method: GENERATE_ROTATING_PARTNER_ROUND,
    params: {
      drawId,
      structureId: preview.structureId,
      roundNumber,
      requestId: randomId(),
      expectedPairings: preview.round,
      expectedScoringContract: preview.scoringContract,
    },
  };
  let pending = false;
  cModal.open({
    title: t('rotatingPartners.creation.previewTitle', { round: roundNumber }),
    content,
    buttons: [
      { label: t('common.cancel'), close: true },
      {
        label: t('rotatingPartners.creation.applyRound'),
        close: false,
        intent: 'is-primary',
        onClick: () => {
          if (pending) return;
          pending = true;
          mutationRequest({
            methods: [method],
            callback: (result) => {
              pending = false;
              if (result.success) {
                cModal.close();
                callback?.();
              }
            },
          });
        },
      },
    ],
  });
}

export function showRotatingStandings(drawId: string): void {
  const result = tournamentEngine.getRotatingPartnerStandings({ drawId });
  if (result.error) {
    tmxToast({ message: String(result.info ?? result.error.message), intent: WARNING_INTENT });
    return;
  }
  const participants = tournamentEngine.getTournament().tournamentRecord?.participants ?? [];
  const names = new Map(participants.map((participant) => [participant.participantId, participant.participantName]));
  const content = document.createElement('div');
  for (const standing of result.standings ?? []) {
    const row = document.createElement('p');
    row.textContent = `${names.get(standing.participantId) ?? standing.participantId}: ${standing.pointsScored}`;
    content.appendChild(row);
  }
  if (result.unresolved?.length) {
    const notice = document.createElement('p');
    notice.textContent = t('rotatingPartners.creation.unresolved', { count: result.unresolved.length });
    content.appendChild(notice);
  }
  cModal.open({
    title: t('rotatingPartners.creation.standings'),
    content,
    buttons: [{ label: t('common.close'), close: true }],
  });
}

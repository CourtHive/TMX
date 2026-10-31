/**
 * Correct the order in which a dual's completed lines finished, per matchUpType. Each line gets a number from 1 within
 * its cohort; saving sends one `setOrderOfFinish` per cohort.
 */
import { finishingOrderMethods, isValidFinishingOrder, orderOfFinishCohorts } from './orderOfFinish';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { logMutationError } from 'functions/logMutationError';
import { tmxToast } from 'services/notifications/tmxToast';
import { renderForm } from 'courthive-components';
import { t } from 'i18n';

const cohortHeading = (matchUpType: string) =>
  matchUpType === 'DOUBLES' ? t('formats.doubles') : t('formats.singles');

function lineLabel(dual: any, line: any): string {
  const collectionName = dual.tieFormat?.collectionDefinitions?.find(
    ({ collectionId }: any) => collectionId === line.collectionId,
  )?.collectionName;
  const names = (line.sides ?? []).map((side: any) => side?.participant?.participantName).filter(Boolean);
  return [[collectionName, line.collectionPosition].filter(Boolean).join(' '), names.join(' / ')]
    .filter(Boolean)
    .join(': ');
}

export function orderOfFinishModal({ dual, callback }: { dual: any; callback?: () => void }): void {
  const cohorts = orderOfFinishCohorts(dual);
  if (!cohorts.length) {
    tmxToast({ message: t('overlays.scorecard.noCompletedLines'), intent: 'is-warning' });
    return;
  }

  const fieldOf = (matchUpId: string) => `oof-${matchUpId}`;
  const content = (elem: HTMLElement) =>
    renderForm(elem, [
      { text: t('overlays.scorecard.orderOfFinishHint') },
      ...cohorts.flatMap(({ matchUpType, matchUps }) => {
        const options = matchUps.map((_, index) => ({ label: String(index + 1), value: String(index + 1) }));
        return [
          { text: cohortHeading(matchUpType) },
          ...matchUps.map((line, index) => ({
            label: lineLabel(dual, line),
            value: String(index + 1),
            field: fieldOf(line.matchUpId),
            options,
          })),
        ];
      }),
    ]);

  const save = ({ content }: any) => {
    const chosen = (line: any) => Number(content?.[fieldOf(line.matchUpId)]?.value);
    const valid = cohorts.every(({ matchUps }) => isValidFinishingOrder(matchUps.map(chosen)));
    if (!valid) {
      tmxToast({ message: t('overlays.scorecard.orderOfFinishInvalid'), intent: 'is-warning' });
      return;
    }

    const orderedCohorts = cohorts.map(({ matchUps }) =>
      [...matchUps].sort((a, b) => chosen(a) - chosen(b)).map(({ matchUpId }) => matchUpId),
    );
    mutationRequest({
      methods: finishingOrderMethods({ drawId: dual.drawId, orderedCohorts }),
      callback: (result: any) => {
        if (result?.success) {
          tmxToast({ message: t('overlays.scorecard.orderOfFinishSaved'), intent: 'is-success' });
          callback?.();
        } else {
          logMutationError('setOrderOfFinish', result, { message: t('overlays.scorecard.orderOfFinishFailed') });
        }
      },
    });
  };

  openModal({
    title: t('overlays.scorecard.orderOfFinish'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('common.save'), intent: 'is-primary', onClick: save as any, close: true },
    ],
  });
}

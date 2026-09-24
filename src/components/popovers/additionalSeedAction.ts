/**
 * "Seed as additional" — the popover that presents the choice and dispatches it.
 *
 * The basis is asked for rather than assumed. `seedingBasis` is what makes the seed
 * self-describing on a draw sheet and in an appeal — "why is there a 33rd seed" has to be
 * answerable from the record, and a default would answer it wrongly as often as not.
 *
 * The rule about WHETHER one may be granted lives in `additionalSeedContext`, which reaches for
 * nothing but the engine and so can be tested without a DOM.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { tipster } from 'components/popovers/tipster';
import { t } from 'i18n';

import { DEFAULT_BASES, seedingBasisLabel } from './additionalSeedContext';

/** Second step of the popover: which basis. `tipster` has no sub-menu, so this replaces the first. */
export function additionalSeedAction({
  target,
  action,
  callback,
}: {
  target: HTMLElement;
  action: any;
  callback: () => void;
}): void {
  const options = (action.bases ?? DEFAULT_BASES).map((basis: string) => ({
    option: seedingBasisLabel(basis),
    onClick: () => {
      const postMutation = (result: any) => {
        if (result?.success) {
          tmxToast({
            message: t('additionalSeeds.added', { seedNumber: action.seedNumber }),
            intent: 'is-success',
          });
          callback();
        } else {
          // The allowance can be spent by another operator between opening this menu and choosing
          // a basis. Saying so is the difference between a refusal and a control that did nothing.
          tmxToast({ message: t('additionalSeeds.refused'), intent: 'is-danger' });
        }
      };
      mutationRequest({
        methods: [{ params: { ...action.payload, seedingBasis: basis }, method: action.method }],
        callback: postMutation,
      });
    },
  }));

  tipster({ options, target, title: t('additionalSeeds.chooseBasis'), config: { arrow: false, offset: [0, 0] } });
}

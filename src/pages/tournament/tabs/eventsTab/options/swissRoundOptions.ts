import { generateSwissRound } from '../renderDraws/generateSwissRound';

// Constants
import { RIGHT } from 'constants/tmxConstants';
import { t } from 'i18n';

export function getSwissRoundOptions({
  structure,
  drawId,
  callback,
}: {
  structure: any;
  drawId: string;
  callback: (params: any) => void;
}): any {
  const refreshCallback = () => callback({ refresh: true });

  return {
    label: t('roundOptions.generateSwissRound'),
    onClick: () => generateSwissRound({ structure, drawId, callback: refreshCallback }),
    location: RIGHT,
    intent: 'is-info',
  };
}

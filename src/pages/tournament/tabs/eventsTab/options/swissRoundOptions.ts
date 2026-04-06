import { generateSwissRound } from '../renderDraws/generateSwissRound';

import { RIGHT } from 'constants/tmxConstants';

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

  const actionOptions = [
    {
      onClick: () => generateSwissRound({ structure, drawId, callback: refreshCallback }),
      label: 'Generate next round',
      color: '#5ba0d0',
    },
  ];

  return {
    label: 'Swiss actions',
    options: actionOptions,
    selection: false,
    location: RIGHT,
    align: RIGHT,
  };
}

import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';

export const scoreMatchUp = (callback) => (e, cell) => {
  const data = cell.getRow().getData();
  const { matchUpId, readyToScore } = data;
  if (readyToScore) enterMatchUpScore({ matchUpId, callback });
};

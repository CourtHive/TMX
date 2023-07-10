import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { setTieScore } from 'components/overlays/scorecard/scorecard';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';

export function scoreHandler(e, cell) {
  const row = cell.getRow();
  const data = row.getData();
  const { matchUpId, readyToScore } = data;
  const callback = (result) => {
    if (result.success) {
      const { matchUpStatus, sets, matchUpFormat, score, winningSide } = result.outcome;
      Object.assign(data, { matchUpStatus, sets, matchUpFormat, score });
      data.winningSide = winningSide && `side${winningSide}`;
      row.update(data);

      const table = cell.getTable();
      table.redraw(true);

      const tieResult = result.results.find(({ methodName }) => methodName === SET_MATCHUP_STATUS)?.tieMatchUpResult;
      setTieScore(tieResult);
    } else {
      console.log({ result });
    }
  };
  if (readyToScore) enterMatchUpScore({ matchUpId, callback });
}

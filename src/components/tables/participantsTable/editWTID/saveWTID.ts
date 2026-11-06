import { toggleEditVisibility } from '../../common/toggleEditVisibility';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { tennisIdMethods } from './tennisIdMethods';

export function saveWTID(e, table) {
  toggleEditVisibility({
    classNames: ['saveTennisId', 'saveRatings'],
    columns: ['tennisId'],
    visible: false,
    table,
    e,
  });

  table.showColumn('tennisId');
  table.redraw(true);

  const participantMap = tournamentEngine.getParticipants().participantMap ?? {};
  const rows = table.getData();
  const methods = tennisIdMethods({ rows, participantMap });

  if (methods.length) {
    const postMutation = (result) => {
      if (!result.success) console.log(result);
    };
    mutationRequest({ methods, callback: postMutation });
  }
}

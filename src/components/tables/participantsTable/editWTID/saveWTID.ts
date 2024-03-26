import { toggleEditVisibility } from '../../common/toggleEditVisibility';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';

// constants
import { MODIFY_PARTICIPANT } from 'constants/mutationConstants';

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

  const participantMap = tournamentEngine.getParticipants().participantMap;
  const rows = table.getData();
  const methods = rows
    .map((row) => {
      const { tennisId, participantId } = row;
      if (tennisId === participantMap[participantId].participant.person.tennisId) return undefined;
      return {
        params: { participant: { participantId, person: { tennisId } } },
        method: MODIFY_PARTICIPANT,
      };
    })
    .filter(Boolean);

  if (methods.length) {
    const postMutation = (result) => {
      if (!result.success) console.log(result);
    };
    mutationRequest({ methods, callback: postMutation });
  }
}

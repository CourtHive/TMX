import { mutationRequest } from 'services/mutation/mutationRequest';

import { REMOVE_INDIVIDUAL_PARTICIPANT_IDS } from 'constants/mutationConstants';

/**
 * Remove the selected individuals from a grouping (TEAM or GROUP — `groupingParticipantId` is agnostic).
 *
 * `callback` lets a caller refresh a surface the table does not own; the row deletion below only updates
 * the sub-table in place, which is enough for the expanded team row but not for a modal sitting over a
 * groupings table whose member count is now stale.
 */
export function removeFromTeam({ table, team, callback }: { table: any; team: any; callback?: () => void }): void {
  const activeIds = new Set(table.getData('active').map((a: any) => a.participantId));
  const selected = table.getSelectedData().filter((s: any) => activeIds.has(s.participantId));
  const individualParticipantIds = selected.map(({ participantId }: any) => participantId);
  // An empty selection previously dispatched a mutation with zero ids — a round-trip that could only
  // ever be a no-op, and on a server-first setup a needless one.
  if (!individualParticipantIds.length) return;
  table.deselectRow();
  const methods = [
    {
      method: REMOVE_INDIVIDUAL_PARTICIPANT_IDS,
      params: {
        groupingParticipantId: team.participantId,
        individualParticipantIds,
        suppressErrors: true,
      },
    },
  ];
  const postMutation = (result: any) => {
    if (result.success) {
      table.deleteRow(individualParticipantIds);
      callback?.();
    }
  };
  mutationRequest({ methods, callback: postMutation });
}

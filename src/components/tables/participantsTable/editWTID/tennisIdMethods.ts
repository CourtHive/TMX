// constants and types
import { MODIFY_PARTICIPANT } from 'constants/mutationConstants';
import type { MutationMethod } from 'types/services';

/**
 * The MODIFY_PARTICIPANT methods that save the edited tennisId column: one per row whose tennisId differs from
 * the stored one. An emptied cell sends '' and the factory clears the stored tennisId; it used to accept the
 * empty string and keep the old id.
 */
export function tennisIdMethods({
  participantMap,
  rows,
}: {
  participantMap: Record<string, any>;
  rows: any[];
}): MutationMethod[] {
  return rows
    .map((row): MutationMethod | undefined => {
      const { tennisId, participantId } = row;
      const storedTennisId = participantMap[participantId]?.participant?.person?.tennisId;
      if (tennisId === storedTennisId || (!tennisId && !storedTennisId)) return undefined;
      return {
        params: { participant: { participantId, person: { tennisId: tennisId ?? '' } } },
        method: MODIFY_PARTICIPANT,
      };
    })
    .filter((method): method is MutationMethod => !!method);
}

/**
 * The entries a draw generation left out because their stage was full.
 *
 * The factory goes on generating when a stage has more entries than places: it takes the entries that fit and
 * leaves the surplus on the event, and says so with one ENTRIES_NOT_PLACED warning per stage on the generation
 * result. This turns those warnings into what the director is told: how many, the draw size, and the names.
 */

// the factory's warning code; a string here so the notice works whether or not the resolved factory exports it
export const ENTRIES_NOT_PLACED = 'ENTRIES_NOT_PLACED';

export type EntriesNotPlacedNotice = {
  isQualifying: boolean;
  drawSize: number;
  names: string[];
  count: number;
  stage: string;
};

type Participant = { participantId: string; participantName?: string };

export function getEntriesNotPlacedNotices({
  participants = [],
  warnings = [],
}: {
  participants?: Participant[];
  warnings?: any[];
}): EntriesNotPlacedNotice[] {
  const nameById = new Map(participants.map(({ participantId, participantName }) => [participantId, participantName]));

  return warnings
    .filter((warning) => warning?.code === ENTRIES_NOT_PLACED && warning.participantIds?.length)
    .map(({ stage, drawSize, participantIds }) => ({
      names: participantIds.map((participantId: string) => nameById.get(participantId) || participantId),
      isQualifying: stage === 'QUALIFYING',
      count: participantIds.length,
      drawSize: drawSize ?? 0,
      stage,
    }));
}

import { acceptedEntryStatuses } from 'constants/acceptedEntryStatuses';
import { drawDefinitionConstants } from 'tods-competition-factory';

const { MAIN } = drawDefinitionConstants;

export function acceptedEntriesCount(event, stage = MAIN) {
  return event.entries.filter(({ entryStage = MAIN, entryStatus }) =>
    acceptedEntryStatuses(stage).includes(`${entryStage}.${entryStatus}`)
  ).length;
}

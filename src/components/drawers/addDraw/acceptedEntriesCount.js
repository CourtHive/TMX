import { drawDefinitionConstants } from 'tods-competition-factory';
import { acceptedEntryStatuses } from 'constants/tmxConstants';

const { MAIN } = drawDefinitionConstants;

export function acceptedEntriesCount(event) {
  return event.entries.filter(({ entryStage = MAIN, entryStatus }) =>
    acceptedEntryStatuses.includes(`${entryStage}.${entryStatus}`)
  ).length;
}

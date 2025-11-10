import { acceptedEntryStatuses } from 'constants/acceptedEntryStatuses';
import { drawDefinitionConstants } from 'tods-competition-factory';

const { MAIN } = drawDefinitionConstants;

export function acceptedEntriesCount(event: any, stage: string = MAIN): number {
  return event.entries.filter(({ entryStage = MAIN, entryStatus }: any) =>
    acceptedEntryStatuses(stage).includes(`${entryStage}.${entryStatus}`)
  ).length;
}

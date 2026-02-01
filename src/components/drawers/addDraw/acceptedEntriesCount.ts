import { acceptedEntryStatuses } from 'constants/acceptedEntryStatuses';
import { factoryConstants } from 'tods-competition-factory';

const { FLIGHT_PROFILE } = factoryConstants.extensionConstants;
const { MAIN } = factoryConstants.drawDefinitionConstants;

export function acceptedEntriesCount({
  stage = MAIN,
  drawId,
  event,
}: {
  drawId?: string;
  event: any;
  stage?: string;
}): number {
  const flightProfile = event?.extensions.find((ext: any) => ext.name === FLIGHT_PROFILE)?.value;
  const flight = flightProfile?.flights?.find((f: any) => f.drawId === drawId);

  const entriesCount = (flight?.drawEntries || event?.entries || []).filter(({ entryStage = MAIN, entryStatus }: any) =>
    acceptedEntryStatuses(stage).includes(`${entryStage}.${entryStatus}`),
  ).length;

  return entriesCount;
}

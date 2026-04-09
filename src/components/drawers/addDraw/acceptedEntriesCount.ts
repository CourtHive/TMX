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
  const flightProfile = event?.extensions?.find((ext: any) => ext.name === FLIGHT_PROFILE)?.value;
  const flight = flightProfile?.flights?.find((f: any) => f.drawId === drawId);
  const matchesStage = ({ entryStage = MAIN, entryStatus }: any) =>
    acceptedEntryStatuses(stage).includes(`${entryStage}.${entryStatus}`);

  // Prefer flight drawEntries when they contain entries for the target stage.
  // Otherwise fall through to event.entries — e.g. qualifying-first flights only
  // track QUALIFYING entries, so counting MAIN must use event.entries.
  const flightEntries = flight?.drawEntries?.filter(matchesStage) ?? [];
  if (flightEntries.length) return flightEntries.length;

  return (event?.entries || []).filter(matchesStage).length;
}

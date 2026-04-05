/**
 * Get draw navigation options for event.
 * Provides menu options to navigate to draws or delete flights.
 */
import { selectAndDeleteEventFlights } from 'components/modals/selectAndDeleteFlights';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { tournamentEngine, extensionConstants } from 'tods-competition-factory';

export function getDrawsOptions({ eventData }: { eventData: any }): any[] {
  const deleteFlights = () => selectAndDeleteEventFlights({ eventData });

  const eventId = eventData?.eventInfo?.eventId;

  // Count total draw items including ungenerated flights
  const event = tournamentEngine.getEvent({ eventId })?.event;
  const drawDefs = event?.drawDefinitions || [];
  const flightProfile = event?.extensions?.find((ext: any) => ext.name === extensionConstants.FLIGHT_PROFILE)?.value;
  const ungeneratedCount = flightProfile?.flights?.filter(
    (f: any) => !drawDefs.find((dd: any) => dd.drawId === f.drawId),
  )?.length || 0;
  const totalDrawItems = eventData.drawsData.length + ungeneratedCount;

  const allDrawsOption = {
    onClick: () => navigateToEvent({ eventId, renderDraw: true }),
    label: 'All draws',
    modifyLabel: false,
    close: true,
  };

  const options: any[] = [allDrawsOption];

  for (const draw of eventData.drawsData) {
    options.push({
      onClick: () => {
        const structureId = draw.structures?.[0]?.structureId;
        const drawId = draw.drawId;
        navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
      },
      label: draw.drawName,
      close: true,
    });
  }

  if (totalDrawItems > 1) {
    options.push({
      onClick: deleteFlights,
      label: 'Delete flights',
      modifyLabel: false,
      close: true,
    });
  }

  return options;
}

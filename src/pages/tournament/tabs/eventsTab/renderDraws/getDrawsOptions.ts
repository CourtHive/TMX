/**
 * Get draw navigation options for event.
 * Provides menu options to navigate to draws or delete flights.
 */
import { selectAndDeleteEventFlights } from 'components/modals/selectAndDeleteFlights';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { tournamentEngine } from 'services/factory/engine';

export function getDrawsOptions({ eventData }: { eventData: any }): any[] {
  const deleteFlights = () => selectAndDeleteEventFlights({ eventData });

  const eventId = eventData?.eventInfo?.eventId;

  // Count total draw items including ungenerated flights
  const event = tournamentEngine.q.event({ eventId });
  const drawDefs = event?.drawDefinitions || [];
  const flightProfile = tournamentEngine.q.flightProfile({ event });
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

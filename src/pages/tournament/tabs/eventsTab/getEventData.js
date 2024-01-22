import { tournamentEngine, tools } from 'tods-competition-factory';

export function getEventData(params) {
  const { eventId, drawId } = params;
  const eventData = tournamentEngine.getEventData({
    participantsProfile: { withIOC: true, withISO2: true, withScaleValues: true, withGroupings: true },
    includePositionAssignments: true,
    eventId,
  })?.eventData;
  const eventType = eventData?.eventInfo?.eventType;
  const drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
  const structures = drawData?.structures || [];
  const structureId = params.structureId || structures?.[0]?.structureId;
  const structure = structures.find((s) => s.structureId === structureId);
  const { roundMatchUps, stage } = tools.makeDeepCopy(structure || {});
  const matchUps = Object.values(roundMatchUps || {}).flat();

  return { eventData, eventType, drawData, structure, structureId, matchUps, stage };
}

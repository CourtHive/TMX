export const mapDrawDefinition = (eventId) => (drawDefinition) => {
  const { drawId, drawName, drawType, entries, matchUpFormat, tieFormat } = drawDefinition;

  const entriesCount = entries?.filter(({ entryStatus }) => entryStatus !== 'WITHDRAWN')?.length;

  return {
    entries: entriesCount || 0,
    matchUpFormat, // needs to default to event.tieFormat
    tieFormat, // needs to default to event.tieFormat
    drawName,
    drawType,
    eventId,
    drawId
  };
};

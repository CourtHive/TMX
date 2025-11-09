export function mapTournamentRecord(tournamentRecord: any): any {
  const searchText = tournamentRecord.tournamentName?.toLowerCase() || 'Error';
  const tournamentImageURL = tournamentRecord.onlineResources?.find(
    ({ name, resourceType }: any) => name === 'tournamentImage' && resourceType === 'URL',
  )?.identifier;
  const offline = tournamentRecord.timeItems?.find(({ itemType }: any) => itemType === 'TMX')?.itemValue?.offline;

  return {
    tournamentId: tournamentRecord.tournamentId,
    id: tournamentRecord.tournamentId,
    searchText,
    tournament: {
      startDate: new Date(tournamentRecord.startDate).toISOString()?.split('T')[0],
      endDate: new Date(tournamentRecord.endDate).toISOString()?.split('T')[0],
      tournamentName: tournamentRecord.tournamentName,
      tournamentImageURL,
      offline,
    },
  };
}

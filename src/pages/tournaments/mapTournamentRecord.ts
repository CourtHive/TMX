import { COURT_SVG_RESOURCE_SUB_TYPE } from 'services/courtSvg/courtSvgUtil';

export function mapTournamentRecord(tournamentRecord: any): any {
  const searchText = tournamentRecord.tournamentName?.toLowerCase() || 'Error';
  const imageResource = tournamentRecord.onlineResources?.find(
    ({ name }: any) => name === 'tournamentImage',
  );
  const tournamentImageURL =
    imageResource?.resourceType === 'URL' ? imageResource.identifier : undefined;
  const courtSvgSport =
    imageResource?.resourceSubType === COURT_SVG_RESOURCE_SUB_TYPE ? imageResource.identifier : undefined;
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
      courtSvgSport,
      offline,
    },
  };
}

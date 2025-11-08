/**
 * Collection matchUp table columns configuration.
 * Defines columns for displaying sides, score, and status in collection matchUp view.
 */
import { collectionParticipantFormatter } from '../common/formatters/collectionParticipantFormatter';
import { scoreFormatter } from 'components/tables/common/formatters/scoreFormatter';
import { handleSideClick } from './collectionSideClick';
import { scoreHandler } from './collectionScoreHandler';

export function getCollectionColumns({ matchUp }: { matchUp: any }): any[] {
  const side1Participant =
    matchUp.sides?.find((side: any) => side.sideNumber === 1)?.participant?.participantName || 'Side 1';
  const side2Participant =
    matchUp.sides?.find((side: any) => side.sideNumber === 2)?.participant?.participantName || 'Side 2';

  const participantSorter = (a: any, b: any) => a?.participantName?.localeCompare(b?.participantName);
  return [
    {
      formatter: collectionParticipantFormatter(handleSideClick(matchUp)),
      cellClick: (e: any, cell: any) => handleSideClick(matchUp)({ event: e, cell }),
      sorter: participantSorter,
      title: side1Participant,
      responsive: false,
      minWidth: 100,
      field: 'side1',
      widthGrow: 2
    },
    {
      formatter: collectionParticipantFormatter(handleSideClick(matchUp)),
      cellClick: (e: any, cell: any) => handleSideClick(matchUp)({ event: e, cell }),
      sorter: participantSorter,
      title: side2Participant,
      responsive: false,
      minWidth: 100,
      field: 'side2',
      widthGrow: 2
    },
    {
      formatter: scoreFormatter,
      cellClick: scoreHandler,
      responsive: false,
      title: 'Score',
      field: 'score',
      width: 140
    },
    {
      field: 'matchUpStatus',
      title: 'Status',
      width: 150
    }
  ];
}

import { collectionParticipantFormatter } from '../common/formatters/collectionParticipantFormatter';
import { scoreFormatter } from 'components/tables/common/formatters/scoreFormatter';
import { handleSideClick } from './collectionSideClick';
import { scoreHandler } from './collectionScoreHandler';

export function getCollectionColumns({ matchUp }) {
  const side1Participant =
    matchUp.sides?.find((side) => side.sideNumber === 1)?.participant?.participantName || 'Side 1';
  const side2Participant =
    matchUp.sides?.find((side) => side.sideNumber === 2)?.participant?.participantName || 'Side 2';

  return [
    {
      formatter: collectionParticipantFormatter,
      cellClick: handleSideClick(matchUp),
      title: side1Participant,
      responsive: false,
      minWidth: 100,
      field: 'side1',
      widthGrow: 2
    },
    {
      formatter: collectionParticipantFormatter,
      cellClick: handleSideClick(matchUp),
      title: side2Participant,
      responsive: false,
      minWidth: 100,
      field: 'side2',
      widthGrow: 2
    },
    {
      cellClick: scoreHandler,
      formatter: scoreFormatter,
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

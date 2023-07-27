import { formatParticipant } from 'components/tables/common/formatters/participantFormatter';

export function collectionParticipantFormatter(cell) {
  const value = cell.getValue();
  if (value.participantName) {
    //
  }
  if (value.participantName) return formatParticipant(cell);
  const elem = document.createElement('div');
  elem.className = 'has-text-warning-dark';
  elem.innerHTML = 'Select participant';
  return elem;
}

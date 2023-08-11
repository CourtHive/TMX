import { formatParticipant } from 'components/tables/common/formatters/participantFormatter';

export const collectionParticipantFormatter = (onClick) => (cell) => {
  const value = cell.getValue();
  if (value.participantName) return formatParticipant(onClick)(cell);
  const elem = document.createElement('div');
  elem.className = 'has-text-warning-dark';
  elem.innerHTML = 'Select participant';
  return elem;
};

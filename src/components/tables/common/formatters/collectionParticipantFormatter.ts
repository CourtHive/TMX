import { formatParticipant } from 'components/tables/common/formatters/participantFormatter';

export const collectionParticipantFormatter = (onClick: any) => (cell: any): HTMLDivElement => {
  const placholder = document.createElement('div');
  placholder.className = 'has-text-warning-dark';
  placholder.innerHTML = 'Select participant';

  const value = cell.getValue();
  const participantValue = value.participantName && formatParticipant(onClick)(cell, placholder, undefined);
  return participantValue ?? placholder;
};

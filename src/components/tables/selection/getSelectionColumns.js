import { genderedText } from '../common/formatters/genderedText';

export function getSelectionColumns(data) {
  const drawPositions = data.some((item) => item.drawPosition);

  return [
    {
      visible: drawPositions,
      field: 'drawPosition',
      title: 'Position',
      headerSort: false,
      responsive: false,
      editor: false,
      maxWidth: 100
    },
    {
      formatter: genderedText,
      field: 'participantName',
      title: 'Participant',
      responsive: false,
      minWidth: 200,
      widthGrow: 2
    }
  ];
}

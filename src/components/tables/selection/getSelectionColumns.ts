import { genderedText } from '../common/formatters/genderedText';
import { t } from 'i18n';

export function getSelectionColumns(data: any[]): any[] {
  const drawPositions = data.some((item) => item.drawPosition);

  return [
    {
      visible: drawPositions,
      field: 'drawPosition',
      title: t('tables.selection.position'),
      headerSort: false,
      responsive: false,
      editor: false,
      maxWidth: 100
    },
    {
      formatter: genderedText,
      field: 'participantName',
      title: t('tables.selection.participant'),
      responsive: false,
      minWidth: 200,
      widthGrow: 2
    }
  ];
}

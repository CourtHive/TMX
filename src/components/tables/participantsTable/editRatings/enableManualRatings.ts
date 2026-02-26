import { toggleEditVisibility } from '../../common/toggleEditVisibility';

export function enableManualRatings(e: any, table: any): void {
  // Dynamically find all rating columns in the table
  const ratingColumns = table
    .getColumns()
    .filter((c: any) => c.getField()?.startsWith('ratings.'))
    .map((c: any) => c.getField());

  toggleEditVisibility({
    columns: ratingColumns,
    className: 'saveRatings',
    visible: true,
    table,
    e,
  });

  for (const field of ratingColumns) {
    table.showColumn(field);
  }
  table.redraw(true);
}

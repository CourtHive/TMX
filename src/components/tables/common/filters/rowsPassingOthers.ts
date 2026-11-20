/**
 * The rows every filter but `excluded` lets through: what a footer chip group counts, so turning one chip on never
 * zeroes its siblings. Only function filters are evaluated; the matchUps and participants tables install no other kind.
 */
export function rowsPassingOthers(table: any, excluded: (rowData: any) => boolean): any[] {
  const others = (table.getFilters?.() ?? [])
    .map((filter: any) => filter.field)
    .filter((field: any) => typeof field === 'function' && field !== excluded);
  return (table.getData?.() ?? []).filter((rowData: any) => others.every((filter: any) => filter(rowData)));
}

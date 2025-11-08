export function arrayLengthFormatter(cell: any): number {
  const value = cell.getValue();
  return value?.length || 0;
}

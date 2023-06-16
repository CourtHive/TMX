export function arrayLengthFormatter(cell) {
  const value = cell.getValue();
  return value?.length || 0;
}

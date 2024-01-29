export function percentFormatter(cell) {
  const value = cell.getValue();
  return value && `${(parseFloat(value) * 100).toFixed(0)}%`;
}

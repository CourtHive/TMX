export function percentFormatter(cell: any): string | undefined {
  const value = cell.getValue();
  return value && `${(Number.parseFloat(value) * 100).toFixed(0)}%`;
}

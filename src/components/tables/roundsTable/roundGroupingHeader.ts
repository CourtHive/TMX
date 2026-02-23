export function roundGroupingHeader(value: string, count: number): string {
  const itemDisplay = count > 1 ? 'items' : 'item';

  return value + `<span style='color:var(--tmx-accent-blue); margin-left:10px;'>(${count} ${itemDisplay})</span>`;
}

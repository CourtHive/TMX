export function roundGroupingHeader(value: string, count: number, _data: any[], _group: any): string {
  const itemDisplay = count > 1 ? 'items' : 'item';

  return value + `<span style='color:blue; margin-left:10px;'>(${count} ${itemDisplay})</span>`;
}

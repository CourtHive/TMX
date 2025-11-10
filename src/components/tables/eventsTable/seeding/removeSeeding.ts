import { saveSeedingValues } from './saveSeedingValues';

export function removeSeeding({ table }: { table: any }): string | undefined {
  const rows = table.getRows();
  let entryStage: string | undefined;

  for (const row of rows) {
    const data = row.getData();
    entryStage = data.entryStage;
    data.seedNumber = undefined;
    row.update(data);
  }

  return entryStage;
}

export function clearSeeding({ event, table }: { event: any; table: any }): void {
  removeSeeding({ table });
  const rows = table.getData();
  saveSeedingValues({ event, rows });
}

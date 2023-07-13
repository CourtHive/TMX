import { saveSeedingValues } from './saveSeedingValues';

export function removeSeeding({ table }) {
  const rows = table.getRows();
  let entryStage;

  for (const row of rows) {
    const data = row.getData();
    entryStage = data.entryStage;
    data.seedNumber = undefined;
    row.update(data);
  }

  return entryStage;
}

export function clearSeeding({ event, table }) {
  removeSeeding({ table });
  const rows = table.getData();
  saveSeedingValues({ event, rows });
}

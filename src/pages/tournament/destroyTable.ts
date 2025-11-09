import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { context } from 'services/context';

export function destroyTable({ anchorId }: { anchorId: string }): void {
  const previousRender = Tabulator.findTable(`#${anchorId}`)[0];
  if (previousRender) previousRender.destroy();
}

export function destroyTables(): void {
  if (context.tables) {
    for (const key of Object.keys(context.tables)) {
      context.tables[key]?.destroy();
      delete context.tables[key];
    }
  }

  while ((context.collectionTables || []).length) {
    const table = context.collectionTables?.pop();
    table?.destroy();
  }
}

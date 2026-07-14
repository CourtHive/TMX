/**
 * Reflect renamed draws in a draws Tabulator table without a full re-render.
 * Shared by the draws-list "Rename selected" buttons and the per-draw [Actions]
 * "Rename" menu so the visible drawName cells update in place after a rename.
 */
export function updateDrawNameRows(drawsTable: any, renamed: { drawId: string; drawName: string }[]): void {
  if (!drawsTable) return;
  for (const { drawId, drawName } of renamed) {
    const targetRow = drawsTable.getRows().find((r: any) => r.getData()?.drawId === drawId);
    targetRow?.update({ drawName });
  }
}

import { tournamentEngine } from 'services/factory/engine';

export function eventTabDeleteDraws({ eventRow, drawsTable, drawIds }) {
  drawsTable.deleteRow(drawIds);
  const rowData = eventRow?.getData();
  if (rowData) {
    const matchUps = tournamentEngine.allEventMatchUps({
      eventId: rowData.eventId,
      inContext: false,
    }).matchUps;
    rowData.drawDefs = rowData.drawDefs.filter((drawDef) => !drawIds.includes(drawDef.drawId));
    rowData.matchUpsCount = matchUps?.length || 0; // table data is reactive!
    rowData.drawsCount -= drawIds.length; // table data is reactive!
  }
}

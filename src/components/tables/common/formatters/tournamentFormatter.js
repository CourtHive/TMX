export function tournamentFormatter(cell) {
  const content = document.createElement('span');
  const rowTable = document.createElement('table');
  const values = cell.getValue();
  rowTable.style.width = '400px';

  const rowTabletr = document.createElement('tr');
  const cellContents =
    `<td style='min-width: 3em'><img src='${values.media}' alt=''></td>` +
    `<td>` +
    `<div style='margin-left: 1em'><strong style='font-size: 1.5em'>${values.tournamentName}</strong></div>` +
    `<div style='margin-left: 1em'>${values.startDate} / ${values.endDate}</div>` +
    `</td>`;

  rowTabletr.innerHTML = cellContents;
  rowTable.appendChild(rowTabletr);
  content.appendChild(rowTable);

  return content;
}

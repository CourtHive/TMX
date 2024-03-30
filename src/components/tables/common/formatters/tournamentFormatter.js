export const tournamentFormatter = (isMobile) => (cell) => {
  const rowTable = document.createElement('table');
  const values = cell.getValue();
  rowTable.style.width = '400px';

  const imageSize = '4em';
  const rowTabletr = document.createElement('tr');
  if (values.offline) {
    const rowElement = cell.getRow().getElement();
    rowElement.style.backgroundColor = 'lightyellow';
  }
  const img = values.tournamentImageURL
    ? `<img src='${values.tournamentImageURL}' style='width: ${imageSize}' alt=''>`
    : '';
  let cellContents =
    (isMobile ? '' : `<td style='min-width: ${imageSize};'>${img}</td>`) +
    `<td>` +
    `<div style='margin-left: 1em'><strong style='font-size: 1.5em'>${values.tournamentName}</strong></div>` +
    `<div style='margin-left: 1em'>${values.startDate} / ${values.endDate}</div>` +
    `</td>`;

  rowTabletr.innerHTML = cellContents;
  rowTable.appendChild(rowTabletr);

  const content = document.createElement('span');
  content.appendChild(rowTable);

  return content;
};

import { createCourtSvg } from 'services/courtSvg/courtSvgUtil';

export const tournamentFormatter =
  (isMobile: boolean) =>
  (cell: any): HTMLSpanElement => {
    const rowTable = document.createElement('table');
    const values = cell.getValue();
    rowTable.style.width = '400px';

    const imageSize = '4em';
    const rowTabletr = document.createElement('tr');
    if (values.offline) {
      const rowElement = cell.getRow().getElement();
      rowElement.style.backgroundColor = 'var(--tmx-bg-highlight)';
    }

    // Build image cell: URL image > court SVG > empty
    let imageTd: HTMLTableCellElement | undefined;
    if (!isMobile) {
      imageTd = document.createElement('td');
      imageTd.style.minWidth = imageSize;

      if (values.tournamentImageURL) {
        const img = document.createElement('img');
        img.src = values.tournamentImageURL;
        img.alt = '';
        img.style.width = imageSize;
        imageTd.appendChild(img);
      } else if (values.courtSvgSport) {
        const svg = createCourtSvg(values.courtSvgSport);
        if (svg) {
          svg.style.width = imageSize;
          svg.style.height = 'auto';
          svg.style.opacity = '0.7';
          imageTd.appendChild(svg);
        }
      }
    }

    const textTd = document.createElement('td');
    textTd.innerHTML =
      `<div style='margin-left: 1em'><strong style='font-size: 1.5em'>${values.tournamentName}</strong></div>` +
      `<div style='margin-left: 1em'>${values.startDate} / ${values.endDate}</div>`;

    if (imageTd) rowTabletr.appendChild(imageTd);
    rowTabletr.appendChild(textTd);
    rowTable.appendChild(rowTabletr);

    const content = document.createElement('span');
    content.appendChild(rowTable);

    return content;
  };

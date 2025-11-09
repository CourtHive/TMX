export function profileFormatter(cell): HTMLSpanElement {
  const data = cell.getRow().getData();
  const content = document.createElement('span');
  
  if (!data.competitiveProfile?.competitiveness) return content;

  const { competitiveProfile, score } = data;

  const colorMap = {
    COMPETITIVE: 'green',
    DECISIVE: 'magenta',
    ROUTINE: 'blue',
  };

  if (score) {
    const { competitiveness } = competitiveProfile;
    content.style.color = colorMap[competitiveness];
    content.style.fontSize = 'smaller';
    content.innerHTML = competitiveness;
  }

  return content;
}

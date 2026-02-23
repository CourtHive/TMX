export function profileFormatter(cell): HTMLSpanElement {
  const data = cell.getRow().getData();
  const content = document.createElement('span');
  
  if (!data.competitiveProfile?.competitiveness) return content;

  const { competitiveProfile, score } = data;

  const colorMap = {
    COMPETITIVE: 'var(--tmx-accent-green)',
    DECISIVE: 'var(--tmx-accent-purple)',
    ROUTINE: 'var(--tmx-accent-blue)',
  };

  if (score) {
    const { competitiveness } = competitiveProfile;
    content.style.color = colorMap[competitiveness];
    content.style.fontSize = 'smaller';
    content.innerHTML = competitiveness;
  }

  return content;
}

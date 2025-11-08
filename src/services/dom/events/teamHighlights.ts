export function highlightTeam(element: HTMLElement): void {
  for (const team of Array.from(document.querySelectorAll('.tmx-tm')).filter(
    (x) => x.innerHTML === element.innerHTML
  ) as HTMLElement[]) {
    team.style.fontWeight = 'bold';
    team.style.color = '#ed0c76';
  }
}

export function removeTeamHighlight(element: HTMLElement): void {
  for (const team of Array.from(document.querySelectorAll('.tmx-tm')).filter(
    (x) => x.innerHTML === element.innerHTML
  ) as HTMLElement[]) {
    team.style.fontWeight = '';
    team.style.color = '';
  }
}

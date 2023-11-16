export function highlightTeam(element) {
  for (const team of Array.from(document.querySelectorAll('.tmx-tm')).filter(
    (x) => x.innerHTML === element.innerHTML
  )) {
    team.style.fontWeight = 'bold';
    team.style.color = '#ed0c76';
  }
}

export function removeTeamHighlight(element) {
  for (const team of Array.from(document.querySelectorAll('.tmx-tm')).filter(
    (x) => x.innerHTML === element.innerHTML
  )) {
    team.style.fontWeight = '';
    team.style.color = '';
  }
}

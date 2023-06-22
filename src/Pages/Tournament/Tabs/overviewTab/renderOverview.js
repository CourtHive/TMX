import { TOURNAMENT_OVERVIEW } from 'constants/tmxConstants';

export function renderOverview() {
  const element = document.getElementById(TOURNAMENT_OVERVIEW);
  element.style.height = `${window.innerHeight * 0.9}px`;
  element.innerHTML = 'Tournament Overview';
}

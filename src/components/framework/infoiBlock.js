import { TOURNAMENT_OVERVIEW } from 'constants/tmxConstants';

export function tournamentInfoBlock() {
  const div = document.createElement('div');
  div.className = 'is-marginless';
  div.style.width = 'inherit';
  div.id = 'o-tab';

  div.innerHTML = `
    <div class="tab_section events_tab">
        <div class="section" style='padding-top: 1em;'}>
            <div id=${TOURNAMENT_OVERVIEW} class="box tournament-information">
            </div>
        </div>
    </div>
  `;

  return div;
}

import { displayTournament } from 'Pages/Tournament/tournamentDisplay';
import { tmx2db } from 'services/storage/tmx2db';
import * as safeJSON from 'utilities/safeJSON';
import { context } from 'services/context';
import { lang } from 'services/translator';

export function receiveTournamentRecord({ record }) {
  let publishedTournament = safeJSON.parse({ data: record, maxTilde: 5 });

  if (publishedTournament) {
    let content = `<div>
          <h4 class="subtitle is-5">
            <b>${publishedTournament.name}</b>
          </h4>
          <h5>${lang.tr('tournaments.publishtime')}:</h5>
        </div>`;

    let buttons = [
      {
        label: lang.tr('tournaments.replacelocal'),
        intent: 'is-warning',
        onClick: saveReceivedTournament
      },
      { label: lang.tr('tournaments.close') }
    ];
    context.modal.open({
      title: lang.tr('tournaments.received'),
      content,
      buttons
    });
  }

  function saveReceivedTournament() {
    publishedTournament.received = new Date().getTime();
    let tournament = publishedTournament;
    tmx2db.addTournament(tournament).then(displayTourney, (err) => console.log(err));
  }
  function displayTourney() {
    displayTournament({
      tournamentId: publishedTournament.tournamentId
    });
  }
}

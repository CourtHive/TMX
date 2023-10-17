import { contentEquals } from 'services/transitions/screenSlaver';
import { tmxToast } from 'services/notifications/tmxToast';
import { eventManager } from 'services/dom/events/eventManager';
import { openModal } from './baseModal/baseModal';
import { tmx2db } from 'services/storage/tmx2db';
import * as safeJSON from 'utilities/safeJSON';
import { lang } from 'services/translator';
import { context } from 'services/context';
import { env } from 'settings/env';

import { db } from 'services/storage/db';

export function authMessage(msg) {
  console.log(msg);
  tmx2db.findTournament(msg.tournamentId).then(pushMessage, (err) => console.log(err));

  function pushMessage(tournament) {
    eventManager.call('tournamentAuthorization', 'tap', tournament);

    if (tournament && msg.tournament && msg.send_auth) {
      const content = `
        <div class="content">
          <p>Choose to keep the existing tournament or replace the local copy with the incoming tournament</p>
        </div>
        `;

      const keepExisting = () => tournamentExists(tournament);
      const keepReceived = () => addReceivedTournament(msg.tournament);
      openModal({
        title: 'Save tournament',
        content,
        buttons: [
          { label: 'Save Received', onClick: keepReceived, close: true },
          { label: 'Keep Existing', onClick: keepExisting, close: true },
          { label: 'Cancel', close: true }
        ]
      });
    } else if (!tournament && msg.tournament) {
      addReceivedTournament(msg.tournament);
    } else if (tournament) {
      tournamentExists(tournament);
    } else {
      noTournament();
    }

    if (msg.referee_key) {
      context.ee.emit('sendKey', msg.referee_key);
    }
    if (msg.tournament_key) {
      addTournamentKey(msg.tournament_key, msg.tuid);
    }

    function addReceivedTournament(received_tournament) {
      let tournament = safeJSON.parse({
        data: received_tournament,
        maxTilde: 5
      });
      if (tournament) {
        context.ee.emit('updateTournament', tournament);
        if (tournament.start) tournament.start = new Date(tournament.start).getTime();
        if (tournament.end) tournament.end = new Date(tournament.end).getTime();
        db.addTournament(tournament).then(() => tournamentExists(tournament), noTournament);
      }
    }

    function tournamentExists(tournament) {
      msg.inDB = true;
      msg.notice = `${tournament.name}`;

      let message = `${lang.tr(msg.title)}: ${msg.notice}`;
      let action = contentEquals('tournament') && { text: lang.tr('tournaments.edit'), onClick: displayTournament };
      tmxToast({ intent: 'is-success', message, action });
    }

    function displayTournament() {
      console.log('display tournament');
    }
    function noTournament() {
      msg.notice = 'Not Found in Calendar';
      env.messages.push(msg);
    }
  }
}

function addTournamentKey(tournament_key, tuid) {
  const done = () => console.log('added tournament key');
  db.findSetting('tournamentKeys').then(addToKeyRing, addToKeyRing);
  function addToKeyRing(setting = { key: 'tournamentKeys', ring: [] }) {
    setting.ring = setting.ring.filter((k) => k.key !== tournament_key);
    if (tournament_key && tuid) {
      setting.ring.push({ key: tournament_key, tuid, ouid: env.org?.ouid });
      db.addSetting(setting).then(done, done);
    }
  }
}

import { receiveTournamentRecord } from 'components/modals/receiveTournamentRecord';
import { processDirective } from 'services/processDirective';
import { authMessage } from 'components/modals/authMessage';
import { eventManager } from 'services/dom/eventManager';
import { modalTarget } from 'services/dom/modalTarget';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import { isDev } from 'functions/isDev';
import { env } from 'settings/env';

import { changeIdiom } from '../services/idiomFx';

import { PROCESS_DIRECTIVE } from 'constants/comsConstants';

export function initConfig() {
  return new Promise((resolve, reject) => {
    initListeners();

    const initWithDB = () => {};

    const DBready = () => {
      initWithDB();
      env.first_time_user = env.first_time_user && context.ee.emit('sendKey', 'players') ? false : env.first_time_user;
      resolve();
    };

    initDB().then(DBready, reject);
  });
}

const catchAsync =
  (fn) =>
  (...args) =>
    isDev() ? fn(...args) : fn(...args).catch((err) => console.log(err));

function initDB() {
  return new Promise((resolve, reject) => {
    const initTMXdb = () => new Promise((rz, rj) => catchAsync(tmx2db.initDB)().then(resolve, dbUpgrade).then(rz, rj));
    initTMXdb().then(resolve, reject);
  });
}

// older versions of Dexie required this step
function dbUpgrade() {
  const message = '<h2>Database Upgraded</h2><div style="margin: 1em;">Please Close Browser and Re-launch</div>';
  context.modal.inform({ message });
}

function addMessage(msg) {
  const msgHash = (m) =>
    Object.keys(m)
      .map((key) => m[key])
      .join('');
  const messageHash = msgHash(msg);
  const exists = env.messages.reduce((p, c) => (msgHash(c) === messageHash ? true : p), false);
  if (!exists) env.messages.push(msg);
}

function tmxMessage(msg) {
  console.log({ tmxMessage: msg });
  if (msg.authorized && (msg.tuid || msg.tournamentId)) {
    authMessage(msg);
  } else {
    msg.notice = msg.notice || msg.tournament;
    if (msg.notice) addMessage(msg);
  }
}

function initListeners() {
  eventManager.register('modalPeer', 'tap', modalTarget);

  context.ee.addListener('receiveTournamentRecord', receiveTournamentRecord);
  context.ee.addListener(PROCESS_DIRECTIVE, processDirective);
  context.ee.addListener('changeIdiom', changeIdiom);
  context.ee.addListener('tmxMessage', tmxMessage);
  context.ee.addListener('addMessage', addMessage);
}

import { getLoginState } from 'services/authentication/loginState';
import { tools } from 'tods-competition-factory';
import * as safeJSON from 'utilities/safeJSON';
import { context } from 'services/context';
import { lang } from 'services/translator';
import { isDev } from 'functions/isDev';
import io from 'socket.io-client';
import { env } from 'settings/env';

import {
  AVAILABLE_IDIOMS,
  CLIENT_ERROR,
  JOIN_TOURNAMENT,
  LEAVE_TOURNAMENT,
  PROCESS_DIRECTIVE,
  PROVIDER_CONFIG,
  SEND_KEY,
  TMX_DIRECTIVE,
  TMX_ERROR,
  TMX_MESSAGE,
} from 'constants/comsConstants';

export const coms = (() => {
  let fx = {};

  let socketQueue = [];
  let ackRequests = {};
  let connected = false;

  fx.init = () => {
    initListeners();
  };

  function initListeners() {
    context.ee.addListener('emitTmx', fx.emitTmx);
    context.ee.addListener('sendKey', fx.sendKey);
    context.ee.addListener('queueKey', fx.queueKey);
    context.ee.addListener('logError', fx.logError);
    context.ee.addListener(LEAVE_TOURNAMENT, fx.leaveTournament);
  }

  let oi = {
    socket: undefined,
    connectionOptions: {
      'force new connection': true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 'Infinity',
      timeout: 20000,
    },
  };

  const getNavigator = () => {
    try {
      return navigator || window.navigator;
    } catch (e) {
      return undefined;
    }
  };
  fx.onLine = () => {
    // eslint-disable-next-line
    return getNavigator().onLine || location.hostname === 'localhost';
  };

  // keyQueue is used for keys that can't be sent/submitted until the env is set up with user uuid
  let keyQueue = [];
  fx.queueKey = (key) => keyQueue.push(key);
  fx.sendKey = (key) => fx.emitTmx({ data: { action: SEND_KEY, payload: { key } } });
  fx.sendQueuedKeys = () => {
    keyQueue.forEach(fx.sendKey);
    keyQueue = [];
  };

  fx.connected = () => connected;
  function comsConnect() {
    connected = true;
    connectionEvent();
    while (socketQueue.length) {
      let message = socketQueue.pop();
      socketEmit(message.header, message.data);
    }
  }

  fx.logError = (err) => {
    if (!err) return;
    const stack = err.stack?.toString();
    const errorMessage = typeof err === 'object' ? safeJSON.stringify(err) : err;
    const payload = { stack, error: errorMessage };
    fx.emitTmx({ data: { action: CLIENT_ERROR, payload } });
  };

  function connectionEvent() {
    fx.connectAction();

    /*
    if (contentEquals('tournament')) {
      fx.joinTournament({
        authorized: context.state.authorized,
        tuid: tournamentId,
        tournamentId
      });
    } else {
      if (tournament?.tuid) fx.leaveTournament(tournamentId);
    }
    */
  }

  function comsDisconnect() {
    connected = false;
  }
  function comsError(err) {
    console.log('comsError', { err });
  }
  fx.connectAction = () => fx.sendQueuedKeys();

  fx.disconnectSocket = () => {
    oi.socket.disconnect();
    setTimeout(() => delete oi.socket, 1000);
  };
  fx.connectSocket = () => {
    let msgMon = (x) => console.log(x);
    const chcsServerPath = '';

    if (!oi.socket) {
      if (window.dev) console.log({ URL });
      const server =
        window.location.hostname.startsWith('localhost') || window.location.hostname === '127.0.0.1'
          ? 'http://127.0.0.1:8383'
          : window.location.hostname;
      const connectionString = `${server}/mobile`;

      let connectionOptions = {
        'force new connection': true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 'Infinity',
        timeout: 20000,
        path: `${chcsServerPath}/socket.io`,
      };

      oi.socket = io.connect(connectionString, connectionOptions);

      oi.socket.on('testscore', (x) => msgMon(`testscore:${x}`));

      oi.socket.on('ack', (ack) => {
        msgMon({ ack });
        receiveAcknowledgement(ack);
      });
      oi.socket.on('connect', () => {
        const state = getLoginState();
        const providerId = state?.provider?.organisationId;

        comsConnect();
        if (providerId) {
          fx.emitTmx({
            data: {
              payload: { providerId },
              action: PROVIDER_CONFIG,
            },
          });
        }
      });
      oi.socket.on('disconnect', comsDisconnect);
      oi.socket.on('connect_error', (data) => {
        msgMon('connect_error');
        comsError(data);
      });
      oi.socket.on(PROVIDER_CONFIG, (data) => {
        console.log({ [PROVIDER_CONFIG]: data });
        env[PROVIDER_CONFIG] = data;
      });
      oi.socket.on(TMX_ERROR, tmxError);

      oi.socket.on(TMX_DIRECTIVE, (data) => {
        context.ee.emit(PROCESS_DIRECTIVE, data);
      });
      oi.socket.on(TMX_MESSAGE, (data) => {
        context.ee.emit(TMX_MESSAGE, data);
      });

      oi.socket.on(AVAILABLE_IDIOMS, (list) => {
        msgMon({ message: AVAILABLE_IDIOMS, list });
      });

      oi.socket.on('tournament record', (data) => {
        console.log('receive tournamentRecord', { data });
      });

      oi.socket.on('auth_org_trnys', (tournaments) => {
        console.log('receive tournamentRecords', { tournaments });
      });

      oi.socket.on('liveScores', (data) => {
        msgMon('liveScores');
        context.ee.emit('liveScores', data);
      });
      oi.socket.on('liveScore', (data) => {
        msgMon('liveScore');
        context.ee.emit('liveScore', data);
      });

      oi.socket.on('console', (data) => msgMon({ data }));
      oi.socket.on('registeredPlayers', (data) => {
        msgMon('registeredPlayers');
        context.ee.emit('registeredPlayers', data);
      });
      oi.socket.on('tournamentCalendar', (data) => {
        msgMon('tournamentCalendar');
        context.ee.emit('tournamentCalendar', data);
      });
    }
  };

  function receiveAcknowledgement(msg) {
    if (msg.ackId && ackRequests[msg.ackId]) {
      ackRequests[msg.ackId](msg);
      delete ackRequests[msg.ackId];
    }
    if (msg.uuid && ackRequests[msg.uuid]) {
      ackRequests[msg.uuid](msg);
      delete ackRequests[msg.uuid];
    }
  }

  fx.requestAcknowledgement = ({ ackId, uuid, callback }) => {
    if (ackId) ackRequests[ackId] = callback;
    if (uuid) ackRequests[uuid] = callback;
  };

  fx.leaveTournament = (tuid) => {
    if (connected && tuid)
      fx.emitTmx({
        data: { action: LEAVE_TOURNAMENT, payload: { tournamentId: tuid } },
      });
  };
  fx.joinTournament = ({ tuid }) => {
    if (connected) {
      fx.emitTmx({
        data: {
          payload: { tournamentId: tuid, authorized: true },
          action: JOIN_TOURNAMENT,
        },
      });
    }
    return connected;
  };

  function tmxError(err) {
    if (!err) return;
    let message = err.phrase ? lang.tr(`phrases.${err.phrase}`) : err.error;
    if (err.key && err.key.indexOf('ITA') === 0) {
      message = `
            Keys are one-time use<p>
            After initial launch of TMX, go to CourtHive.com/tmx<p>
            Tournaments can be found in the Calendar or via the search field<p>
            If you need to re-authorized delete the R2 key and generate a new one
         `;
    }
    if (message) {
      context.modal.inform({
        title: lang.tr('phrases.servererror'),
        message,
      });
    }
  }

  fx.emitTmx = emitTmx;
  function emitTmx({ data, ackCallback }) {
    const state = getLoginState(); // TODO: return token from getLoginState();
    const userId = state?.email;
    const messageType = data?.action ? `tmx-one` : 'tmx';
    const providerId = state?.provider?.organisationId;

    if (connected) {
      if (ackCallback && typeof ackCallback === 'function') {
        let ackId = tools.UUID();
        if (data.payload) Object.assign(data.payload, { ackId });

        fx.requestAcknowledgement({ ackId, callback: ackCallback });
      }

      if (data?.payload) {
        Object.assign(data.payload, {
          timestamp: new Date().getTime(),
          version: env.version,
          providerId,
          userId,
        });
      } else {
        Object.assign(data, {
          timestamp: new Date().getTime(),
          version: env.version,
          providerId,
          userId,
        });
      }

      socketEmit(messageType, data);

      if (messageType !== 'tmx-one') console.log({ messageType, data });
    } else {
      socketQueue.push({ header: messageType, data, ackCallback });
    }
  }

  function socketEmit(msg, data) {
    if (!oi.socket.connected) console.log('socket not connected');
    oi.socket.emit(msg, data);
  }

  fx.catchSync =
    (fn, errorAction) =>
    (...args) => {
      if (isDev()) {
        return fn(...args);
      } else {
        try {
          return fn(...args);
        } catch (err) {
          fx.logError(err);
          if (errorAction && typeof errorAction === 'function') {
            errorAction();
          }
        }
      }
    };

  return fx;
})();

import { tools, version as factoryVersion } from 'tods-competition-factory';
import { getLoginState } from 'services/authentication/loginState';
import { getToken } from 'services/authentication/tokenManagement';
import { processDirective } from 'services/processDirective';
import { isFunction } from 'functions/typeOf';
import { version } from 'config/version';
import { io } from 'socket.io-client';

import { CLIENT_ERROR, SEND_KEY, TMX_DIRECTIVE, TMX_MESSAGE } from 'constants/comsConstants';

function getAuthorization() {
  const token = getToken();
  if (!token) return undefined;
  const authorization = `Bearer ${token}`;
  return { authorization };
}

const oi = {
  socket: undefined,
};

const ackRequests = {};
const socketQueue = [];

function tmxMessage(data) {
  console.log('tmxMessage:', { data });
}

export function connectSocket(callback) {
  const connectionOptions = {
    transportOptions: { polling: { extraHeaders: getAuthorization() } },
    'force new connection': true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 'Infinity',
    timeout: 20000,
  };
  if (!oi.socket) {
    // const local = window.location.host.includes('localhost');
    // TODO: move to .env file
    // const socketPath = local ? 'http://localhost:8383/tmx' : 'https://courthive.net/tmx';
    const server =
      window.location.hostname.startsWith('localhost') || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:8383'
        : window.location.hostname;
    const connectionString = `${server}/tmx`; // TODO: change to /tmx
    oi.socket = io.connect(connectionString, connectionOptions);
    oi.socket.on('ack', receiveAcknowledgement);
    oi.socket.on(TMX_MESSAGE, tmxMessage);
    oi.socket.on(TMX_DIRECTIVE, processDirective);
    oi.socket.on('connect', () => connectionEvent(callback));
    oi.socket.on('disconnect', () => console.log('disconnect'));
    oi.socket.on('connect_error', (data) => {
      console.log('connection error:', { data });
    });
  } else {
    console.log('socket exists');
  }
}

export function connected() {
  return !!oi.socket;
}

export function disconnectSocket() {
  oi?.socket && oi.socket.disconnect();
  setTimeout(() => delete oi.socket, 1000);
}

export function emitTmx({ data, ackCallback }) {
  console.log({ emitTmx: data });
  const state = getLoginState(); // TODO: return token from getLoginState();
  const { profile, userId } = state || {};
  const messageType = data.type ?? 'tmx';

  const { providerId } = profile?.provider || {};

  const action = () => {
    if (ackCallback && typeof ackCallback === 'function') {
      let ackId = tools.UUID();
      if (data.payload) Object.assign(data.payload, { ackId });

      requestAcknowledgement({ ackId, callback: ackCallback });
    }

    Object.assign(data.payload || data, {
      timestamp: new Date().getTime(),
      factoryVersion: factoryVersion(),
      providerId,
      version,
      userId,
    });

    socketEmit(messageType, data);
  };

  if (oi.socket) {
    action();
  } else {
    try {
      connectSocket(action);
    } catch (err) {
      socketQueue.push({ header: messageType, data, ackCallback });
    }
  }
}

function socketEmit(msg, data) {
  if (!oi.socket.connected) console.log('socket not connected');
  oi.socket.emit(msg, data);
}

function connectionEvent(callback) {
  console.log('connected');
  while (socketQueue.length) {
    let message = socketQueue.pop();
    socketEmit(message.header, message.data);
  }

  isFunction(callback) && callback();
}

function requestAcknowledgement({ ackId, uuid, callback }) {
  if (ackId) ackRequests[ackId] = callback;
  if (uuid) ackRequests[uuid] = callback;
}

function receiveAcknowledgement(ack) {
  console.log('receiveAcknowledgement:', { ack });
  if (ack.ackId && ackRequests[ack.ackId]) {
    ackRequests[ack.ackId](ack);
    delete ackRequests[ack.ackId];
  }
  if (ack.uuid && ackRequests[ack.uuid]) {
    ackRequests[ack.uuid](ack);
    delete ackRequests[ack.uuid];
  }
}

export function logError(err) {
  if (!err) return;
  const stack = err.stack?.toString();
  const errorMessage = typeof err === 'object' ? JSON.stringify(err) : err;
  const payload = { stack, error: errorMessage };
  emitTmx({ data: { action: CLIENT_ERROR, payload } });
}

let keyQueue = [];
export function queueKey(key) {
  keyQueue.push(key);
}
const sendKey = (key) => emitTmx({ data: { action: SEND_KEY, payload: { key } } });
export function sendQueuedKeys() {
  keyQueue.forEach(sendKey);
  keyQueue = [];
}

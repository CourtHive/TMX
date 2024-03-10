import { getLoginState } from 'services/authentication/loginState';
import { getToken } from 'services/authentication/tokenManagement';
import { processDirective } from 'services/processDirective';
import { tools, version } from 'tods-competition-factory';
import { version as tmxVersion } from 'config/version';
import { isFunction, isObject } from 'functions/typeOf';
import { io } from 'socket.io-client';
import { env } from 'settings/env';

import { CLIENT_ERROR, SEND_KEY, TMX_DIRECTIVE, TMX_MESSAGE } from 'constants/comsConstants';

function getAuthorization() {
  const token = getToken();
  if (!token) return undefined;
  const authorization = `Bearer ${token}`;
  return { authorization };
}

const oi = {
  timestampOffset: 0,
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
    // const local = window.location.host.includes('localhost') || window.location.hostname === '127.0.0.1';
    // const socketPath = env.socketPath || local ? 'http://127.0.0.1:8383' : 'https://courthive.net';
    const socketPath = env.socketPath || process.env.SERVER;
    const connectionString = `${socketPath}/tmx`; // TODO: change to /tmx
    oi.socket = io.connect(connectionString, connectionOptions);
    oi.socket.on('ack', receiveAcknowledgement);
    oi.socket.on(TMX_MESSAGE, tmxMessage);
    oi.socket.on(TMX_DIRECTIVE, processDirective);
    oi.socket.on('connect', () => connectionEvent(callback));
    oi.socket.on('disconnect', () => console.log('disconnect'));
    oi.socket.on('timestamp', (data) => (oi.timestampOffset = new Date().getTime() - data.timestamp));
    oi.socket.on('connect_error', (data) => {
      console.log('connection error:', { data });
      disconnectSocket();
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
  const state = getLoginState();
  const { email: userId } = state || {};
  const messageType = data.type ?? 'tmx';

  const action = () => {
    if (ackCallback && isFunction(ackCallback)) {
      const ackId = tools.UUID();
      if (data.payload) Object.assign(data.payload, { ackId });

      requestAcknowledgement({ ackId, callback: ackCallback });
    }

    const timestamp = oi.timestampOffset ? new Date().getTime() + oi.timestampOffset : new Date().getTime();
    Object.assign(data.payload || data, {
      factoryVersion: version(),
      tmxVersion,
      timestamp,
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
  if (!oi.socket.connected) {
    console.log('socket not connected');
  } else {
    oi.socket.emit(msg, data);
  }
}

function connectionEvent(callback) {
  console.log('** connected');
  emitTmx({ data: { type: 'timestamp' } });
  while (socketQueue.length) {
    const message = socketQueue.pop();
    // todo: add message to submitted messages and if no ack, resubmit
    socketEmit(message.header, message.data);
  }

  isFunction(callback) && callback();
}

function requestAcknowledgement({ ackId, uuid, callback }) {
  if (ackId) ackRequests[ackId] = callback;
  if (uuid) ackRequests[uuid] = callback;
}

function receiveAcknowledgement(ack) {
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
  const errorMessage = isObject(err) ? JSON.stringify(err) : err;
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

import { getLoginState } from 'services/authentication/loginState';
import { utilities } from 'tods-competition-factory';
import { version } from 'config/version';
import { io } from 'socket.io-client';

import { TMX_MESSAGE } from 'constants/comsConstants';

const oi = {
  socket: undefined,
  connectionOptions: {
    'force new connection': true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 'Infinity',
    timeout: 20000
  }
};

const ackRequests = {};
const socketQueue = [];

function tmxMessage(data) {
  console.log('tmxMessage:', { data });
}

export function connectSocket() {
  if (!oi.socket) {
    const local = window.location.host.includes('localhost');
    // TODO: move to .env file
    const socketPath = local ? 'http://localhost:8383/tmx' : 'https://courthive.net/tmx';
    oi.socket = io.connect(socketPath);
    oi.socket.on('ack', receiveAcknowledgement);
    oi.socket.on(TMX_MESSAGE, tmxMessage);
    oi.socket.on('connect', connectionEvent);
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
  const state = getLoginState(); // TODO: return token from getLoginState();
  const { profile, userId } = state || {};
  const messageType = data?.action ? `tmx-one` : 'tmx';

  const { providerId } = profile?.provider || {};

  if (oi.socket) {
    if (ackCallback && typeof ackCallback === 'function') {
      let ackId = utilities.UUID();
      if (data.payload) Object.assign(data.payload, { ackId });

      requestAcknowledgement({ ackId, callback: ackCallback });
    }

    if (data?.payload) {
      Object.assign(data.payload, {
        timestamp: new Date().getTime(),
        providerId,
        version,
        userId
      });
    } else {
      Object.assign(data, {
        timestamp: new Date().getTime(),
        providerId,
        version,
        userId
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

function connectionEvent() {
  const state = getLoginState();
  const providerId = state?.profile?.provider?.providerId;

  console.log('connected:', { providerId });

  while (socketQueue.length) {
    let message = socketQueue.pop();
    socketEmit(message.header, message.data);
  }
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

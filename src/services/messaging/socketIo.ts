/**
 * Socket.IO client for real-time communication.
 * Handles WebSocket connections, message emission, and acknowledgements.
 */
import { getLoginState } from 'services/authentication/loginState';
import { getToken } from 'services/authentication/tokenManagement';
import { processDirective } from 'services/processDirective';
import { tools, version } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction, isObject } from 'functions/typeOf';
import { version as tmxVersion } from 'config/version';
import { io } from 'socket.io-client';
import { env } from 'settings/env';

import { CLIENT_ERROR, SEND_KEY, TMX_DIRECTIVE, TMX_MESSAGE } from 'constants/comsConstants';

function getAuthorization(): { authorization: string } | undefined {
  const token = getToken();
  if (!token) return undefined;
  const authorization = `Bearer ${token}`;
  return { authorization };
}

const oi: any = {
  timestampOffset: 0,
  socket: undefined,
};

const ackRequests: Record<string, (ack: any) => void> = {};
const socketQueue: any[] = [];

function tmxMessage(data: any): void {
  console.log('tmxMessage:', { data });
}

export function connectSocket(callback?: () => void): void {
  const connectionOptions: any = {
    transportOptions: { polling: { extraHeaders: getAuthorization() } },
    'force new connection': true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 'Infinity',
    timeout: 20000,
  };
  if (!oi.socket) {
    const socketPath = env.socketPath || process.env.SERVER || '';
    const connectionString = `${socketPath}/tmx`;
    oi.socket = io(connectionString, connectionOptions);
    oi.socket.on('ack', receiveAcknowledgement);
    oi.socket.on(TMX_MESSAGE, tmxMessage);
    oi.socket.on(TMX_DIRECTIVE, processDirective);
    oi.socket.on('connect', () => connectionEvent(callback));
    oi.socket.on('disconnect', () => console.log('disconnect'));
    oi.socket.on('timestamp', (data: any) => (oi.timestampOffset = new Date().getTime() - data.timestamp));
    oi.socket.on('connect_error', (data: any) => {
      console.log('connection error:', { data });
      tmxToast({ message: 'Connection error', intent: 'is-danger' });
      disconnectSocket();
    });
  } else {
    console.log('socket exists');
  }
}

export function connected(): boolean {
  return !!oi.socket;
}

export function disconnectSocket(): void {
  oi?.socket?.disconnect();
  setTimeout(() => delete oi.socket, 1000);
}

export function emitTmx({ data, ackCallback }: { data: any; ackCallback?: (ack: any) => void }): void {
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

function socketEmit(msg: string, data: any): void {
  if (!oi.socket.connected) {
    console.log('socket not connected');
  } else {
    oi.socket.emit(msg, data);
  }
}

function connectionEvent(callback?: () => void): void {
  console.log('** connected');
  emitTmx({ data: { type: 'timestamp' } });
  while (socketQueue.length) {
    const message = socketQueue.pop();
    socketEmit(message.header, message.data);
  }

  isFunction(callback) && callback && callback();
}

function requestAcknowledgement({ ackId, uuid, callback }: { ackId?: string; uuid?: string; callback: (ack: any) => void }): void {
  if (ackId) ackRequests[ackId] = callback;
  if (uuid) ackRequests[uuid] = callback;
}

function receiveAcknowledgement(ack: any): void {
  if (ack.ackId && ackRequests[ack.ackId]) {
    ackRequests[ack.ackId](ack);
    delete ackRequests[ack.ackId];
  }
  if (ack.uuid && ackRequests[ack.uuid]) {
    ackRequests[ack.uuid](ack);
    delete ackRequests[ack.uuid];
  }
}

export function logError(err: any): void {
  if (!err) return;
  const stack = err.stack?.toString();
  const errorMessage = isObject(err) ? JSON.stringify(err) : err;
  const payload = { stack, error: errorMessage };
  emitTmx({ data: { action: CLIENT_ERROR, payload } });
}

let keyQueue: string[] = [];
export function queueKey(key: string): void {
  keyQueue.push(key);
}
const sendKey = (key: string) => emitTmx({ data: { action: SEND_KEY, payload: { key } } });
export function sendQueuedKeys(): void {
  keyQueue.forEach(sendKey);
  keyQueue = [];
}

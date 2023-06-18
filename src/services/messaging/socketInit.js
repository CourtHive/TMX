import { getLoginState } from 'services/authentication/loginState';
import { io } from 'socket.io-client';

const oi = {
  socket: undefined,
  connectionOptions: {
    'force new connection': true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 'Infinity',
    timeout: 20000
  }
};

export function connectSocket() {
  if (!oi.socket) {
    const local = window.location.host.includes('localhost');
    const socketPath = local ? 'http://localhost:8383/tmx' : '/tmx';
    oi.socket = io.connect(socketPath);

    oi.socket.on('ack', (ack) => {
      console.log({ ack });
    });

    oi.socket.on('connect', () => {
      const state = getLoginState();
      const providerId = state?.profile?.provider?.providerId;

      console.log('connected:', { providerId });
    });
    oi.socket.on('disconnect', () => console.log('disconnect'));
    oi.socket.on('connect_error', (data) => {
      console.log('connection error:', { data });
    });
  } else {
    console.log('socket exists');
  }
}

export function disconnectSocket() {
  oi.socket.disconnect();
  setTimeout(() => delete oi.socket, 1000);
}

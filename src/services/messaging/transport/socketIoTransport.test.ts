import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Socket.IO MessageTransport against a fake socket.io-client: what it asks
 * io() for, how it maps lifecycle events, and that it refuses to send while
 * disconnected.
 */

const fake = vi.hoisted(() => {
  const state: any = {};
  state.reset = () => {
    state.handlers = {} as Record<string, (arg?: any) => void>;
    state.managerHandlers = {} as Record<string, () => void>;
    state.emit = vi.fn();
    state.connect = vi.fn();
    state.disconnect = vi.fn();
    state.options = undefined;
    state.socket = {
      connected: false,
      id: 'sock-1',
      on: (event: string, handler: any) => (state.handlers[event] = handler),
      emit: state.emit,
      connect: state.connect,
      disconnect: state.disconnect,
      io: {
        opts: {} as any,
        on: (event: string, handler: any) => (state.managerHandlers[event] = handler),
      },
    };
  };
  return state;
});

vi.mock('socket.io-client', () => ({
  io: (_url: string, options: any) => {
    fake.options = options;
    fake.socket.io.opts = { transportOptions: options.transportOptions };
    return fake.socket;
  },
}));

import { createSocketIoTransport } from './socketIoTransport';

describe('createSocketIoTransport', () => {
  let token: string | undefined;

  beforeEach(() => {
    fake.reset();
    token = 'token-1';
  });

  const create = () => createSocketIoTransport({ url: 'http://server/tmx', getToken: () => token });

  it('presents the current token on every handshake, not the one at creation', () => {
    create();
    token = 'token-2';
    const cb = vi.fn();
    fake.options.auth(cb);
    expect(cb).toHaveBeenCalledWith({ token: 'token-2' });
  });

  // Defect: the polling Authorization header was fixed when the socket was created, so after a
  // token refresh every reconnect over polling presented the expired token.
  it('refreshes the polling Authorization header before each reconnect attempt', () => {
    create();
    expect(fake.options.transportOptions.polling.extraHeaders).toEqual({ authorization: 'Bearer token-1' });

    token = 'token-2';
    fake.managerHandlers.reconnect_attempt();

    expect(fake.socket.io.opts.transportOptions.polling.extraHeaders).toEqual({ authorization: 'Bearer token-2' });
  });

  it('sends nothing and reports false while disconnected', () => {
    const transport = create();
    expect(transport.send('executionQueue', { a: 1 })).toBe(false);
    expect(fake.emit).not.toHaveBeenCalled();
  });

  it('sends and reports true while connected', () => {
    const transport = create();
    fake.socket.connected = true;
    expect(transport.send('executionQueue', { a: 1 })).toBe(true);
    expect(fake.emit).toHaveBeenCalledWith('executionQueue', { a: 1 });
  });

  it('maps socket lifecycle events onto transport status', () => {
    const transport = create();
    const status = vi.fn();
    transport.onStatus(status);

    fake.handlers.connect();
    fake.handlers.disconnect('transport close');
    fake.handlers.connect_error({ message: 'refused' });

    expect(status.mock.calls).toEqual([
      ['connected'],
      ['disconnected', 'transport close'],
      ['error', { message: 'refused' }],
    ]);
  });

  it('reconnect drops and re-opens the connection', () => {
    create().reconnect();
    expect(fake.disconnect).toHaveBeenCalledTimes(1);
    expect(fake.connect).toHaveBeenCalledTimes(1);
    expect(fake.disconnect.mock.invocationCallOrder[0]).toBeLessThan(fake.connect.mock.invocationCallOrder[0]);
  });
});

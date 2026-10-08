import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
vi.mock('services/apis/baseApi', () => ({ baseApi: { post } }));

describe('commands over HTTP', () => {
  let http: typeof import('./httpCommands');
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    post.mockReset();
    vi.resetModules();
    http = await import('./httpCommands');
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  const command = (ackId: string) => ({ type: 'executionQueue', payload: { ackId, methods: [{ method: 'm' }] } });
  const chat = { tournamentId: 't1', message: 'hi', clientMsgId: 'c1' };
  const ack = (payload: any) => ({ deliver: { event: 'ack', payload } });
  const NO_RESPONSE = 'no response';
  const CHAT_REJECTED = 'chatRejected';

  describe('toCommandOutcome', () => {
    it('acks a success', () => {
      expect(http.toCommandOutcome('a1', { status: 200, data: { success: true, publicNotices: [] } })).toEqual(
        ack({ ackId: 'a1', success: true }),
      );
    });

    // P49: the write times ride the ack, as on the socket.
    it('carries the write times on a success', () => {
      const serverUpdatedAt = { t1: '2026-10-08T19:30:00.000Z' };
      const previousServerUpdatedAt = { t1: '2026-10-08T19:29:00.000Z' };
      expect(
        http.toCommandOutcome('a1', { status: 200, data: { success: true, serverUpdatedAt, previousServerUpdatedAt } }),
      ).toEqual(ack({ ackId: 'a1', success: true, serverUpdatedAt, previousServerUpdatedAt }));
    });

    // checkEngineError: InternalServerErrorException({ message, code, context, info }).
    it("carries the engine's refusal as the socket ack does, code and all", () => {
      const data = { statusCode: 500, message: 'addEvent: missing', code: 'ERR_MISSING_TOURNAMENT', context: { c: 1 } };
      expect(http.toCommandOutcome('a1', { status: 500, data })).toEqual(
        ack({
          ackId: 'a1',
          error: { message: 'addEvent: missing', code: 'ERR_MISSING_TOURNAMENT' },
          context: { c: 1 },
        }),
      );
    });

    it("carries the mutation gate's 403 as a refusal", () => {
      const data = { statusCode: 403, message: 'Not permitted: addEvent', error: 'Forbidden' };
      expect(http.toCommandOutcome('a1', { status: 403, data })).toEqual(
        ack({ ackId: 'a1', error: { message: 'Not permitted: addEvent' } }),
      );
    });

    it('reads an error the body itself carries', () => {
      const data = { error: { message: 'nope', code: 'ERR_X' } };
      expect(http.toCommandOutcome('a1', { status: 200, data })).toEqual(
        ack({ ackId: 'a1', error: { message: 'nope', code: 'ERR_X' } }),
      );
    });

    // No answer is not a refusal: these must reach the same paths as a socket ack that never came.
    it('treats no response, a gateway error and a 401 as unreachable, and delivers no ack', () => {
      expect(http.toCommandOutcome('a1', undefined)).toEqual({ unreachable: NO_RESPONSE });
      expect(http.toCommandOutcome('a1', { status: 504, data: '<html>' })).toEqual({ unreachable: 'gateway 504' });
      expect(http.toCommandOutcome('a1', { status: 502 })).toEqual({ unreachable: 'gateway 502' });
      expect(http.toCommandOutcome('a1', { status: 401, data: {} })).toEqual({ unreachable: 'not authenticated' });
    });
  });

  describe('toChatOutcome', () => {
    it('turns the answer into the chatAccepted / chatRejected the socket would emit', () => {
      const accepted = { clientMsgId: 'c1', seq: 4, timestamp: 9 };
      expect(http.toChatOutcome('c1', { status: 200, data: { accepted } })).toEqual({
        deliver: { event: 'chatAccepted', payload: accepted },
      });
      const rejected = { clientMsgId: 'c1', error: 'Not authorized to view this tournament' };
      expect(http.toChatOutcome('c1', { status: 200, data: { rejected } })).toEqual({
        deliver: { event: CHAT_REJECTED, payload: rejected },
      });
    });

    it('fails an unanswered message rather than leaving it at "sending"', () => {
      expect(http.toChatOutcome('c1', undefined)).toEqual({
        unreachable: NO_RESPONSE,
        deliver: { event: CHAT_REJECTED, payload: { clientMsgId: 'c1', error: NO_RESPONSE } },
      });
    });

    it('fails any answer that is neither', () => {
      expect(http.toChatOutcome('c1', { status: 500, data: { message: 'x' } })).toEqual({
        deliver: { event: CHAT_REJECTED, payload: { clientMsgId: 'c1', error: 'HTTP 500' } },
      });
      expect(http.toChatOutcome('c1', { status: 200, data: { ignored: true } })).toEqual({
        deliver: { event: CHAT_REJECTED, payload: { clientMsgId: 'c1', error: 'ignored' } },
      });
    });
  });

  it('posts a mutation to /factory without letting baseApi toast a refusal', async () => {
    post.mockResolvedValue({ status: 200, data: { success: true } });
    await http.postCommand('executionQueue', command('a1'));

    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/factory');
    expect(body).toEqual(command('a1').payload);
    expect(config.silenceErrors).toBe(true);
    expect(config.validateStatus(500)).toBe(true);
    expect(config.validateStatus(401)).toBe(false); // left to baseApi's refresh-and-retry
  });

  it('posts a chat message to /tmx/chat', async () => {
    post.mockResolvedValue({ status: 200, data: { accepted: { clientMsgId: 'c1', seq: 1, timestamp: 2 } } });
    const outcome = await http.postCommand('chatMessage', chat);
    expect(post.mock.calls[0].slice(0, 2)).toEqual(['/tmx/chat', chat]);
    expect(outcome.deliver?.event).toBe('chatAccepted');
  });

  it('sends one command at a time, in order', async () => {
    let releaseFirst: ((value: any) => void) | undefined;
    post.mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)));
    post.mockResolvedValueOnce({ status: 200, data: { success: true } });

    const first = http.postCommand('executionQueue', command('a1'));
    const second = http.postCommand('executionQueue', command('a2'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(post).toHaveBeenCalledTimes(1);

    releaseFirst?.({ status: 200, data: { success: true } });
    await Promise.all([first, second]);
    expect(post.mock.calls.map((call) => call[1].ackId)).toEqual(['a1', 'a2']);
  });

  it('holds the commands behind one that got no answer until the connection is back', async () => {
    post.mockResolvedValueOnce(undefined);
    post.mockResolvedValue({ status: 200, data: { success: true } });

    expect(await http.postCommand('executionQueue', command('a1'))).toHaveProperty('unreachable');
    expect(await http.postCommand('executionQueue', command('a2'))).toHaveProperty('unreachable');
    // A held chat message is failed, not left at "sending".
    const held = await http.postCommand('chatMessage', chat);
    expect(held.deliver).toEqual({ event: CHAT_REJECTED, payload: { clientMsgId: 'c1', error: NO_RESPONSE } });
    expect(post).toHaveBeenCalledTimes(1);

    http.resumeCommands();
    expect(await http.postCommand('executionQueue', command('a3'))).toEqual(ack({ ackId: 'a3', success: true }));
  });
});

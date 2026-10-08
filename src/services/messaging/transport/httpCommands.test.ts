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

  describe('toCommandOutcome', () => {
    it('acks a success', () => {
      expect(http.toCommandOutcome('a1', { status: 200, data: { success: true, publicNotices: [] } })).toEqual({
        ack: { ackId: 'a1', success: true },
      });
    });

    // checkEngineError: InternalServerErrorException({ message, code, context, info }).
    it("carries the engine's refusal as the socket ack does, code and all", () => {
      const data = { statusCode: 500, message: 'addEvent: missing', code: 'ERR_MISSING_TOURNAMENT', context: { c: 1 } };
      expect(http.toCommandOutcome('a1', { status: 500, data })).toEqual({
        ack: {
          ackId: 'a1',
          error: { message: 'addEvent: missing', code: 'ERR_MISSING_TOURNAMENT' },
          context: { c: 1 },
        },
      });
    });

    it("carries the mutation gate's 403 as a refusal", () => {
      const data = { statusCode: 403, message: 'Not permitted: addEvent', error: 'Forbidden' };
      expect(http.toCommandOutcome('a1', { status: 403, data })).toEqual({
        ack: { ackId: 'a1', error: { message: 'Not permitted: addEvent' } },
      });
    });

    it('reads an error the body itself carries', () => {
      const data = { error: { message: 'nope', code: 'ERR_X' } };
      expect(http.toCommandOutcome('a1', { status: 200, data })).toEqual({
        ack: { ackId: 'a1', error: { message: 'nope', code: 'ERR_X' } },
      });
    });

    // No answer is not a refusal: these must reach the same paths as a socket ack that never came.
    it('treats no response, a gateway error and a 401 as unreachable, not as a refusal', () => {
      expect(http.toCommandOutcome('a1', undefined)).toHaveProperty('unreachable');
      expect(http.toCommandOutcome('a1', { status: 504, data: '<html>' })).toHaveProperty('unreachable');
      expect(http.toCommandOutcome('a1', { status: 502 })).toHaveProperty('unreachable');
      expect(http.toCommandOutcome('a1', { status: 401, data: {} })).toHaveProperty('unreachable');
    });
  });

  it('posts the payload to /factory without letting baseApi toast a refusal', async () => {
    post.mockResolvedValue({ status: 200, data: { success: true } });
    await http.postCommand('executionQueue', command('a1'));

    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/factory');
    expect(body).toEqual(command('a1').payload);
    expect(config.silenceErrors).toBe(true);
    expect(config.validateStatus(500)).toBe(true);
    expect(config.validateStatus(401)).toBe(false); // left to baseApi's refresh-and-retry
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
    expect(post).toHaveBeenCalledTimes(1);

    http.resumeCommands();
    expect(await http.postCommand('executionQueue', command('a3'))).toEqual({ ack: { ackId: 'a3', success: true } });
  });
});

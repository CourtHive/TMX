/**
 * A stand-in for the score-relay, so journeys can drive live scoring without a
 * relay process (CI has none) and without touching a real one (a dev box does).
 *
 * Two halves, matching the two ways TMX talks to the relay:
 *
 * - Socket.IO `/live` — what a tracker's frames reach TMX through. TMX's real
 *   socket.io client (`services/messaging/scoreRelay.ts`) connects to
 *   `ws://localhost:8384/socket.io/` with the websocket transport only; this
 *   answers the engine.io open + the `/live` namespace connect on that socket,
 *   records the tournament it subscribes to, and can push `score` frames.
 * - REST `/api/crowd-sessions` — what TMX's crowd poller and trackers dialog
 *   read and write. Pointed at the app origin with `dev.setScoreRelayURL` (as
 *   journey 53 does) so every call is same-origin and fulfilled here.
 *
 * ORDER MATTERS: call `installFakeScoreRelay` BEFORE the first `page.goto`. engine.io-client
 * captures `globalThis.WebSocket` when its module loads, and Playwright routes a websocket by
 * patching that constructor; installed after the app has loaded, the route never sees TMX's
 * socket, which then reaches whatever is listening on :8384 (a real relay on a dev box).
 * Then, once the app is up and before a tournament opens, call `pointScoreRelayAtApp`.
 *
 * Wire format: engine.io v4 packets over the websocket (`0` open, `2`/`3`
 * ping/pong, `4` message); socket.io v5 packets inside a message (`0` connect,
 * `2` event), namespaced as `/live,`. So a `/live` event is `42/live,[...]`.
 */
import type { Page, WebSocketRoute } from '@playwright/test';

export interface FakeScoreRelay {
  /** The tournamentId TMX last subscribed to over `/live` — poll it: `expect.poll(() => relay.subscribedTo())`. */
  subscribedTo: () => string | undefined;
  /** Push a `score` frame to TMX, as the relay fans a tracker's frame out on `/live`. */
  sendScore: (frame: Record<string, unknown>) => void;
  /** The crowd sessions the REST API serves; mutate to change what the next poll sees. */
  sessions: any[];
}

const LIVE_NSP = '/live';

export async function installFakeScoreRelay(page: Page, { sessions = [] as any[] } = {}): Promise<FakeScoreRelay> {
  let socket: WebSocketRoute | undefined;
  const pending: string[] = [];
  let subscribedTournamentId: string | undefined;

  const send = (packet: string) => {
    if (socket) socket.send(packet);
    else pending.push(packet);
  };

  await page.routeWebSocket(/:8384\/socket\.io\//, (ws) => {
    // engine.io open
    ws.send(
      `0${JSON.stringify({ sid: 'e2e-relay', upgrades: [], pingInterval: 25000, pingTimeout: 60000, maxPayload: 1e6 })}`,
    );
    ws.onMessage((message) => {
      const packet = String(message);
      if (packet.startsWith(`40${LIVE_NSP},`)) {
        ws.send(`40${LIVE_NSP},${JSON.stringify({ sid: 'e2e-live' })}`);
        socket = ws;
        for (const queued of pending.splice(0)) ws.send(queued);
        return;
      }
      if (packet.startsWith(`42${LIVE_NSP},`)) {
        const [event, arg] = JSON.parse(packet.slice(`42${LIVE_NSP},`.length));
        if (event === 'subscribe:tournament') subscribedTournamentId = arg;
      }
    });
  });

  const relay: FakeScoreRelay = {
    subscribedTo: () => subscribedTournamentId,
    sendScore: (frame) => send(`42${LIVE_NSP},${JSON.stringify(['score', frame])}`),
    sessions,
  };

  await page.route('**/api/crowd-sessions**', async (route) => {
    const request = route.request();
    const promote = request.url().match(/\/api\/crowd-sessions\/([^/]+)\/(promote|demote)/);
    if (request.method() === 'POST' && promote) {
      const session = relay.sessions.find((s) => s.sessionId === decodeURIComponent(promote[1]));
      if (session) session.trusted = promote[2] === 'promote';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ session }) });
      return;
    }
    const url = new URL(request.url());
    const matchUpId = url.searchParams.get('matchUpId');
    const active = relay.sessions.filter((s) => s.status === 'active');
    const body = { sessions: matchUpId ? active.filter((s) => s.matchUpId === matchUpId) : active };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  return relay;
}

/**
 * Point TMX's relay REST client at the app origin, where `installFakeScoreRelay` answers it. Call after
 * the dev bridge is up and before the tournament opens: opening it starts the crowd poll and connects
 * the `/live` socket, and both are gated on a relay being configured.
 */
export async function pointScoreRelayAtApp(page: Page): Promise<void> {
  await page.evaluate(() => dev.setScoreRelayURL(window.location.origin));
}

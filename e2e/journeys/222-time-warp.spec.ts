import { initDevBridge, resetState } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.log('[pageerror]', error.message));
  // These sessions use synthetic credentials. No request may reach a running development backend.
  await page.route('**/*', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const api = /^\/(factory|auth|account|query|api|providers|users|admin|server)(\/|$)/.test(url.pathname);
    if (api || (['xhr', 'fetch'].includes(request.resourceType()) && url.origin !== 'http://localhost:5181'))
      return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.routeWebSocket(/\/socket\.io\//, (socket) => socket.close());
});

const SOURCE = 'warp-production-source';
const PANEL = '#demoClockPanel';

async function seed(page: Page, provider = false) {
  await page.goto('/#/tournaments');
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(
    async ({ id, provider }) => {
      const path = '/src/pages/tournaments/schedulerDemoProfile.ts';
      const { buildSchedulerDemoProfile } = await import(/* @vite-ignore */ path);
      const profile = buildSchedulerDemoProfile();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        ...profile,
        tournamentAttributes: { ...profile.tournamentAttributes, tournamentId: id },
      });
      tournamentRecord.isMock = false;
      tournamentRecord.tournamentName = 'Production schedule';
      tournamentRecord.extensions = tournamentRecord.extensions.filter((x: any) => x.name !== 'demoScript');
      if (provider) tournamentRecord.parentOrganisation = { organisationId: 'production-provider' };
      await dev.load(tournamentRecord);
      dev.tournamentContext.router.navigate(`/tournament/${id}/scheduling`);
    },
    { id: SOURCE, provider },
  );
  await expect(page).toHaveURL(new RegExp(`${SOURCE}/scheduling`));
  // The original cache is our control: Warp must never replace it or add a calendar entry.
  await page.evaluate(async () => {
    const path = '/src/services/storage/saveTournamentRecord.ts';
    const config = '/src/config/serverConfig.ts';
    const { serverConfig } = await import(/* @vite-ignore */ config);
    serverConfig.set({ saveLocal: true });
    const { saveTournamentRecord } = await import(/* @vite-ignore */ path);
    await saveTournamentRecord();
  });
}

async function enter(page: Page) {
  await page.locator('#login').click();
  await page.getByText('Enter Time Warp', { exact: true }).click();
  await expect(page).toHaveURL(/tournament\/time-warp-/);
  await expect(page.locator(PANEL)).toBeVisible();
  await page.locator(PANEL).getByRole('button', { name: 'Clock controls', exact: true }).click();
}

test('anonymous demo posture: copies, records, discards, returns, and exports after exit', async ({ page }) => {
  await seed(page);
  await page.evaluate(async () => {
    const path = '/src/services/demoMode/demoState.ts';
    const { setDemoOverlay } = await import(/* @vite-ignore */ path);
    setDemoOverlay({ v: 1, preset: 'custom', permissions: { canUseChat: false } });
  });
  const original = await page.evaluate(() =>
    JSON.stringify(dev.factory.tournamentEngine.getTournament().tournamentRecord),
  );
  const ids = await page.evaluate(() => dev.tmx2db.findTournamentIds());
  await enter(page);
  expect(await page.evaluate(() => dev.factory.tournamentEngine.q.tournament().isMock)).toBe(true);
  await expect(page.locator('#pageTitle')).toContainText('Production schedule');
  await expect(page.locator('#pageTitle')).toContainText('Time Warp');
  await expect(page.locator('html')).toHaveAttribute('data-tmx-time-warp', 'true');
  await expect(page.locator(PANEL).getByLabel('Demo mode', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('time-warp.png') });
  await page.locator(PANEL).getByRole('button', { name: 'Start recording', exact: true }).click();
  await page.locator(PANEL).getByRole('button', { name: '+5 min', exact: true }).click();
  const outcome = await page.evaluate(async () => {
    const path = '/src/services/mutation/mutationRequest.ts';
    const { mutationRequest } = await import(/* @vite-ignore */ path);
    return new Promise(
      (resolve) =>
        void mutationRequest({
          methods: [{ method: 'setTournamentName', params: { tournamentName: 'Sandbox edits' } }],
          callback: resolve,
        }),
    );
  });
  expect(outcome).toMatchObject({ success: true });
  await page.locator(PANEL).getByRole('button', { name: 'Stop recording', exact: true }).click();
  expect(
    await page.evaluate(async () => {
      const path = '/src/services/clock/demoWalkthrough.ts';
      const { getDemoWalkthrough, getWalkthroughStatus } = await import(/* @vite-ignore */ path);
      return { status: getWalkthroughStatus(), steps: getDemoWalkthrough()?.steps.map((step: any) => step.kind) };
    }),
  ).toMatchObject({
    status: { available: true, recording: false },
    steps: expect.arrayContaining(['clock', 'mutation']),
  });
  await page.locator(PANEL).getByRole('button', { name: 'Exit Warp', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${SOURCE}/scheduling`));
  await expect(page.locator(PANEL)).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify(dev.factory.tournamentEngine.getTournament().tournamentRecord))).toBe(
    original,
  );
  expect(await page.evaluate(() => dev.tmx2db.findTournamentIds())).toEqual(ids);
  expect(
    await page.evaluate(async () => JSON.stringify(await dev.tmx2db.findTournament('warp-production-source'))),
  ).toBe(original);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tmx_demo_overlay')!))).toMatchObject({
    permissions: { canUseChat: false },
  });
  await page.locator('#login').click();
  const download = page.waitForEvent('download');
  await page.getByText('Export recording', { exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^demo-walkthrough-.*\.json$/);
});

test('signed-in provider Warp sends zero HTTP/socket requests and rejects late uploads', async ({ page }) => {
  await seed(page, true);
  await page.evaluate(() => {
    localStorage.setItem(
      'tmxToken',
      `header.${btoa(
        JSON.stringify({
          email: 'director@example.test',
          roles: ['superadmin'],
          exp: Date.now() / 1000 + 3600,
          provider: { organisationId: 'production-provider' },
        }),
      )}.signature`,
    );
  });
  // Network observation is independent of our guard. Static application modules are allowed to load.
  const traffic: string[] = [];
  page.on('request', (request) => {
    if (
      ['xhr', 'fetch', 'websocket'].includes(request.resourceType()) &&
      !request.url().includes('/src/') &&
      !request.url().includes('/node_modules/') &&
      !request.url().includes('/fonts/')
    )
      traffic.push(request.url());
  });
  page.on('websocket', (socket) => traffic.push(socket.url()));
  // Positive control for the traffic detector: a normal API call reaches the browser network before entry.
  await page.route('**/warp-network-control', (route) => route.fulfill({ json: { success: true } }));
  await page.evaluate(async () => {
    const path = '/src/services/apis/baseApi.ts';
    const { baseApi } = await import(/* @vite-ignore */ path);
    await baseApi.get('/warp-network-control');
  });
  expect(traffic.some((url) => url.endsWith('/warp-network-control'))).toBe(true);
  traffic.length = 0;
  await enter(page);
  const warpId = await page.evaluate(() => dev.factory.tournamentEngine.getTournamentId());
  expect(await page.evaluate(() => dev.factory.tournamentEngine.q.tournament().isMock)).toBe(true);
  const result = await page.evaluate(async () => {
    const api = '/src/services/apis/baseApi.ts';
    const relay = '/src/services/apis/scoreRelayApi.ts';
    const network = '/src/services/network/serverNetwork.ts';
    const socket = '/src/services/messaging/socketIo.ts';
    const mutation = '/src/services/mutation/mutationRequest.ts';
    const { baseApi } = await import(/* @vite-ignore */ api);
    const { scoreRelayApi } = await import(/* @vite-ignore */ relay);
    const { serverFetch } = await import(/* @vite-ignore */ network);
    const { ensureConnected, emitTmx, queuedMessageCount } = await import(/* @vite-ignore */ socket);
    const { mutationRequest } = await import(/* @vite-ignore */ mutation);
    await baseApi
      .post('/factory', { tournamentIds: [dev.factory.tournamentEngine.getTournamentId()] })
      .catch((error: any) => {
        if (error.code !== 'NETWORK_ISOLATED') throw error;
      });
    await scoreRelayApi.get('/api/crowd-sessions').catch(() => undefined);
    await serverFetch('/auth/refresh', { method: 'POST' }).catch(() => undefined);
    try {
      emitTmx({ data: { type: 'executionQueue', payload: {} }, durable: true });
      throw new Error('isolated command was accepted');
    } catch (error: any) {
      if (error.code !== 'NETWORK_ISOLATED') throw error;
    }
    const changed = await new Promise(
      (resolve) =>
        void mutationRequest({
          methods: [{ method: 'setTournamentName', params: { tournamentName: 'Warp only' } }],
          callback: resolve,
        }),
    );
    return { reconnect: ensureConnected(), queued: queuedMessageCount(), changed };
  });
  expect(result).toMatchObject({ reconnect: false, queued: 0, changed: { success: true } });
  await page.locator(PANEL).getByRole('button', { name: '+15 min', exact: true }).click();
  // Allow coalesced clock subscribers to run; this is not dependent on a background poll interval.
  await expect(page.locator(PANEL).locator('output')).toContainText('Time Warp');
  expect(traffic).toEqual([]);
  await page.evaluate(async () => {
    const path = '/src/services/timeWarp/timeWarp.ts';
    const { exitTimeWarp } = await import(/* @vite-ignore */ path);
    exitTimeWarp({ navigate: false, resume: false });
  });
  expect(
    await page.evaluate(async (id) => {
      const path = '/src/services/apis/baseApi.ts';
      const { baseApi } = await import(/* @vite-ignore */ path);
      return await baseApi
        .post('/tournaments', { tournamentRecord: { tournamentId: id, isMock: true } })
        .catch((error: any) => error.code);
    }, warpId),
  ).toBe('NETWORK_ISOLATED');
  expect(traffic).toEqual([]);
  const saved = await page.evaluate(
    async ({ sourceId, retiredId }) => {
      const path = '/src/services/apis/baseApi.ts';
      const { baseApi } = await import(/* @vite-ignore */ path);
      return (
        await baseApi.post('/factory', { tournamentId: sourceId, tournamentName: 'time-warp-cup', notes: retiredId })
      )?.status;
    },
    { sourceId: SOURCE, retiredId: warpId },
  );
  expect(saved).toBe(200);
  expect(traffic.some((url) => url.endsWith('/factory'))).toBe(true);
});

test('reload abandons Warp and returns to its untouched local original', async ({ page }) => {
  await seed(page);
  await enter(page);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${SOURCE}/scheduling`));
  await expect(page.locator(PANEL)).toHaveCount(0);
  await expect(page.locator('#pageTitle')).toContainText('Production schedule');
  expect(await page.evaluate(() => dev.factory.tournamentEngine.getTournamentId())).toBe(SOURCE);
  expect(await page.evaluate(() => sessionStorage.getItem('tmx_time_warp_return'))).toBeNull();
});

test('exiting an online provider Warp loads the current server record without uploading the copy', async ({ page }) => {
  await seed(page, true);
  const authoritative = await page.evaluate(() => dev.factory.tournamentEngine.getTournament().tournamentRecord);
  authoritative.tournamentName = 'Updated by another director';
  const writes: string[] = [];
  let reads = 0;
  await page.route('**/factory/fetch', async (route) => {
    reads++;
    expect(route.request().postDataJSON().tournamentId).toBe(SOURCE);
    await route.fulfill({ json: { tournamentRecords: { [SOURCE]: authoritative } } });
  });
  await page.route('**/factory', async (route) => {
    writes.push(route.request().url());
    await route.fulfill({ json: { success: true } });
  });
  await page.evaluate(() => {
    localStorage.setItem(
      'tmxToken',
      `header.${btoa(
        JSON.stringify({
          email: 'director@example.test',
          roles: ['superadmin'],
          exp: Date.now() / 1000 + 3600,
          provider: { organisationId: 'production-provider' },
        }),
      )}.signature`,
    );
  });
  await enter(page);
  await page.locator(PANEL).getByRole('button', { name: 'Exit Warp', exact: true }).click();
  await expect(page.locator('#pageTitle')).toContainText('Updated by another director');
  expect(reads).toBe(1);
  expect(writes).toEqual([]);
});

test('an existing offline record retains its custody marker and local changes on exit', async ({ page }) => {
  await seed(page, true);
  await page.evaluate(async () => {
    const record = dev.factory.tournamentEngine.getTournament().tournamentRecord;
    record.timeItems = (record.timeItems ?? []).filter((x: any) => x.itemType !== 'TMX');
    record.timeItems.push({ itemType: 'TMX', itemValue: { offline: { email: 'director@example.test' } } });
    record.tournamentName = 'Unsynced local original';
    dev.factory.tournamentEngine.setState(record);
    await dev.tmx2db.addTournament(record);
    localStorage.setItem(
      'tmxToken',
      `header.${btoa(
        JSON.stringify({
          email: 'director@example.test',
          roles: ['superadmin'],
          exp: Date.now() / 1000 + 3600,
          provider: { organisationId: 'production-provider' },
        }),
      )}.signature`,
    );
  });
  const before = await page.evaluate(() => JSON.stringify(dev.factory.tournamentEngine.q.tournament()));
  let fetches = 0;
  await page.route('**/factory/fetch', async (route) => {
    fetches++;
    await route.abort();
  });
  await enter(page);
  await page.locator(PANEL).getByRole('button', { name: 'Exit Warp', exact: true }).click();
  await expect(page.locator('#pageTitle')).toContainText('Unsynced local original');
  expect(await page.evaluate(() => JSON.stringify(dev.factory.tournamentEngine.q.tournament()))).toBe(before);
  expect(
    await page.evaluate(async () => JSON.stringify(await dev.tmx2db.findTournament('warp-production-source'))),
  ).toBe(before);
  expect(fetches).toBe(0);
});

test('refuses entry with pending edits and discards sandbox drafts on exit', async ({ page }) => {
  await seed(page);
  expect(
    await page.evaluate(async () => {
      const queue = '/src/services/schedulingWorkspace/queueService.ts';
      const warp = '/src/services/timeWarp/timeWarp.ts';
      const { setAvailabilityDirty } = await import(/* @vite-ignore */ queue);
      const { enterTimeWarp } = await import(/* @vite-ignore */ warp);
      setAvailabilityDirty(true, null);
      const entered = await enterTimeWarp();
      setAvailabilityDirty(false, null);
      return entered;
    }),
  ).toBe(false);
  await expect(page).toHaveURL(new RegExp(`${SOURCE}/scheduling`));
  await enter(page);
  await page.evaluate(async () => {
    const queue = '/src/services/schedulingWorkspace/queueService.ts';
    const { setAvailabilityDirty } = await import(/* @vite-ignore */ queue);
    setAvailabilityDirty(true, null);
  });
  await page.locator(PANEL).getByRole('button', { name: 'Exit Warp', exact: true }).click();
  expect(
    await page.evaluate(async () => {
      const queue = '/src/services/schedulingWorkspace/queueService.ts';
      const { isAvailabilityDirty } = await import(/* @vite-ignore */ queue);
      return isAvailabilityDirty();
    }),
  ).toBe(false);
  await expect(page).toHaveURL(new RegExp(`${SOURCE}/scheduling`));
});

test('a different identity in another tab discards the sandbox and its recording', async ({ page }) => {
  await seed(page);
  await enter(page);
  await page.locator(PANEL).getByRole('button', { name: 'Start recording', exact: true }).click();
  await page.evaluate(() => {
    localStorage.setItem(
      'tmxToken',
      `header.${btoa(JSON.stringify({ email: 'someone-else@example.test', exp: Date.now() / 1000 + 3600 }))}.signature`,
    );
    window.dispatchEvent(new StorageEvent('storage', { key: 'tmxToken' }));
  });
  await expect(page).toHaveURL(/#\/tournaments/);
  await expect(page.locator(PANEL)).toHaveCount(0);
  expect(
    await page.evaluate(async () => {
      const path = '/src/services/clock/demoWalkthrough.ts';
      const { getWalkthroughStatus } = await import(/* @vite-ignore */ path);
      return getWalkthroughStatus().available;
    }),
  ).toBe(false);
});

test("returning to a local original picks up another tab's committed IndexedDB edit", async ({ page, context }) => {
  await seed(page);
  const original = await page.evaluate(() => dev.factory.tournamentEngine.getTournament().tournamentRecord);
  await enter(page);
  const other = await context.newPage();
  await other.goto('/#/tournaments');
  await initDevBridge(other);
  await other.evaluate(async (record) => {
    record.tournamentName = 'Changed by another tab';
    await dev.tmx2db.addTournament(record);
  }, original);
  await other.close();
  await page.locator(PANEL).getByRole('button', { name: 'Exit Warp', exact: true }).click();
  await expect(page.locator('#pageTitle')).toContainText('Changed by another tab');
  expect(await page.evaluate(() => dev.factory.tournamentEngine.q.tournament()?.isMock)).toBe(false);
});

test('outgoing sandbox controls cannot edit the original during a delayed local return', async ({ page }) => {
  await seed(page);
  await enter(page);
  await page.evaluate(() => {
    const find = dev.tmx2db.findTournament;
    let finish!: () => void;
    dev.tmx2db.findTournament = (id: string) =>
      new Promise((resolve) => {
        finish = () => {
          dev.tmx2db.findTournament = find;
          void find(id).then(resolve);
        };
      });
    (window as any).finishWarpReturn = () => finish();
  });
  await page.locator(PANEL).getByRole('button', { name: 'Exit Warp', exact: true }).click();
  const result = await page.evaluate(async () => {
    const path = '/src/services/mutation/mutationRequest.ts';
    const { mutationRequest } = await import(/* @vite-ignore */ path);
    return new Promise(
      (resolve) =>
        void mutationRequest({
          methods: [{ method: 'setTournamentName', params: { tournamentName: 'Should never land' } }],
          callback: resolve,
        }),
    );
  });
  expect(result).toMatchObject({ error: { message: expect.any(String) } });
  expect(await page.evaluate(() => dev.factory.tournamentEngine.q.tournament()?.tournamentName)).toBe(
    'Production schedule',
  );
  await page.evaluate(() => (window as any).finishWarpReturn());
  await expect(page).toHaveURL(new RegExp(`${SOURCE}/scheduling`));
  await expect(page.locator('#pageTitle')).toContainText('Production schedule');
});

test('ownership changes during local return release isolation and permit another Warp', async ({ page }) => {
  await seed(page);
  await enter(page);
  await page.evaluate(async () => {
    const dbPath = '/src/services/storage/tmx2db.ts';
    const ownerPath = '/src/services/tournament/operationOwnership.ts';
    const { tmx2db } = await import(/* @vite-ignore */ dbPath);
    const { markTournamentRecordInstalled } = await import(/* @vite-ignore */ ownerPath);
    const find = tmx2db.findTournament;
    tmx2db.findTournament = async (...args: any[]) => {
      tmx2db.findTournament = find;
      const record = await find(...args);
      markTournamentRecordInstalled();
      return record;
    };
  });
  await page.locator(PANEL).getByRole('button', { name: 'Exit Warp', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${SOURCE}/scheduling`));
  await enter(page);
});

test('an access token expiring during Warp refreshes only after exit', async ({ page }) => {
  await seed(page, true);
  let refreshes = 0;
  const token = (exp: number) =>
    `header.${Buffer.from(JSON.stringify({ email: 'director@example.test', roles: ['superadmin'], exp, provider: { organisationId: 'production-provider' } })).toString('base64')}.signature`;
  const live = token(Date.now() / 1000 + 3600);
  await page.evaluate((jwt) => {
    localStorage.setItem('tmxToken', jwt);
    localStorage.setItem('tmxRefreshToken', 'warp-test-refresh');
  }, live);
  await page.route('**/auth/refresh', (route) => {
    refreshes++;
    return route.fulfill({ json: { token: live, refreshToken: 'rotated-refresh' } });
  });
  await enter(page);
  await page.evaluate((jwt) => localStorage.setItem('tmxToken', jwt), token(Date.now() / 1000 - 60));
  expect(
    await page.evaluate(async () => {
      const path = '/src/services/authentication/loginState.ts';
      const { getLoginState, attemptSilentRefresh } = await import(/* @vite-ignore */ path);
      const frozen = getLoginState()?.email;
      return { frozen, refreshed: await attemptSilentRefresh() };
    }),
  ).toEqual({ frozen: 'director@example.test', refreshed: true });
  expect(refreshes).toBe(0);
  await page.locator(PANEL).getByRole('button', { name: 'Exit Warp', exact: true }).click();
  await expect.poll(() => refreshes).toBe(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tmxToken'))).toBe(live);
  await expect(page).not.toHaveURL(/time-warp-/);
});

test('a failed local reload discards Warp, warns, and leaves navigation usable', async ({ page }) => {
  await seed(page);
  await enter(page);
  await page.evaluate(async () => {
    const path = '/src/services/storage/tmx2db.ts';
    const { tmx2db } = await import(/* @vite-ignore */ path);
    const find = tmx2db.findTournament;
    tmx2db.findTournament = async () => {
      tmx2db.findTournament = find;
      throw new Error('local-read probe');
    };
  });
  await page.locator(PANEL).getByRole('button', { name: 'Exit Warp', exact: true }).click();
  await expect(page.getByText(/Time Warp ended after a restore error/)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${SOURCE}/scheduling`));
  await expect(page.locator('html')).not.toHaveAttribute('data-tmx-time-warp');
  await enter(page);
});

test('importing a reserved sandbox identity rejects visibly outside Warp', async ({ page }) => {
  await seed(page);
  const result = await page.evaluate(async () => {
    const path = '/src/services/storage/tmx2db.ts';
    const { tmx2db } = await import(/* @vite-ignore */ path);
    return tmx2db
      .addTournament({ tournamentId: 'time-warp-11111111-2222-3333-4444-555555555555', isMock: true })
      .catch((error: any) => error.code);
  });
  expect(result).toBe('NETWORK_ISOLATED');
  await expect(page.getByText(/This tournament ID is reserved for disposable Time Warp copies/)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${SOURCE}/scheduling`));
});

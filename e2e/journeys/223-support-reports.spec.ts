import { test, expect } from '@playwright/test';

const reference = 'cb405e2b-9829-4538-b934-079bc4ea197a';
const receipt = {
  reference,
  accepted: true,
  snapshot: 'not_attached',
  expiresAt: '2026-12-21T00:00:00Z',
  contact: 'pending',
  resolutionEmail: 'none',
  delivery: 'not_sent',
};

test.beforeEach(async ({ page }) => {
  // Synthetic sessions must never reach a developer's backend, including realtime reconnects on Warp exit.
  await page.route('**/*', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const api = /^\/(factory|auth|account|query|api|providers|users|admin|server)(\/|$)/.test(url.pathname);
    if (api || (['xhr', 'fetch'].includes(request.resourceType()) && url.origin !== 'http://127.0.0.1:5187'))
      return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.routeWebSocket(/\/socket\.io\//, (socket) => socket.close());
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      json: {
        userId: 'support-test-user',
        email: 'login@example.test',
        providerIds: ['support-provider'],
        providerRoles: { 'support-provider': 'PROVIDER_ADMIN' },
      },
    }),
  );
  await page.route('**/auth/validate', (route) => route.fulfill({ json: { success: true } }));
  await page.goto('/#/tournaments');
  await page.waitForFunction(() => typeof globalThis.dev !== 'undefined');
  await page.evaluate(() => {
    const payload = {
      userId: 'support-test-user',
      email: 'login@example.test',
      roles: ['CLIENT'],
      providerId: 'support-provider',
      provider: { organisationId: 'support-provider', organisationName: 'Test provider' },
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const encode = (value: unknown) =>
      btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
    localStorage.setItem('tmxToken', `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.test-signature`);
  });
  await expect.poll(() => page.evaluate(() => !!localStorage.getItem('tmxToken'))).toBe(true);
});

test('Help preserves a report through a disabled-intake 503 and retries it idempotently', async ({ page }) => {
  const requests: any[] = [];
  await page.route('**/support/reports', async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (requests.length === 1)
      await route.fulfill({ status: 503, json: { statusCode: 503, message: 'New support reports are disabled' } });
    else await route.fulfill({ json: receipt });
  });
  await page.getByText('Help', { exact: true }).click();
  await page.getByRole('button', { name: 'Report a problem', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Report a problem' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'What went wrong?' }).fill('Creating an event was refused');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByRole('status')).toContainText('not confirmed');
  await expect(dialog.getByRole('textbox', { name: 'What went wrong?' })).toHaveValue('Creating an event was refused');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByRole('status')).toContainText(reference);
  await expect(dialog.getByRole('status')).toContainText('No tournament snapshot attached');
  await expect(dialog.getByRole('status')).toContainText('Verify your contact address');
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
  expect(Object.keys(requests[0]).toSorted((a, b) => a.localeCompare(b))).toEqual([
    'description',
    'evidence',
    'expectedProvider',
    'expectedReporter',
    'submissionKey',
  ]);
  expect(JSON.stringify(requests[0].evidence)).not.toMatch(
    /tournamentRecord|participantId|login@example|contactEmail|instancePath/,
  );
  await page.route(`**/support/reports/${reference}`, (route) =>
    route.fulfill({ json: { ...receipt, contact: 'verified', resolutionEmail: 'accepted', delivery: 'unknown' } }),
  );
  await dialog.getByRole('button', { name: 'Check receipt' }).click();
  await expect(dialog.getByRole('status')).toContainText('Delivery: unconfirmed');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).not.toBeAttached();
});

test('an account/provider change prevents a draft from submitting under the new session', async ({ page }) => {
  let sent = false;
  await page.route('**/support/reports', async (route) => {
    sent = true;
    await route.fulfill({ json: receipt });
  });
  await page.getByText('Help', { exact: true }).click();
  await page.getByRole('button', { name: 'Report a problem', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Report a problem' });
  await dialog.getByRole('textbox', { name: 'What went wrong?' }).fill('A problem');
  await page.evaluate(() => localStorage.removeItem('tmxToken'));
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByRole('status')).toContainText('account or provider changed');
  expect(sent).toBe(false);
});

test('mobile dark form keeps fields and actions within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.getByText('Help', { exact: true }).click();
  await page.getByRole('button', { name: 'Report a problem', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Report a problem' });
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(844);
  await expect(dialog.getByRole('textbox', { name: 'What went wrong?' })).toBeFocused();
  await dialog.screenshot({ path: '/private/tmp/tmx-support-mobile-dark.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeAttached();
  await expect(page.getByText('Help', { exact: true })).toBeFocused();
});

test('account settings reuse HiveID verification without putting the contact address into a report', async ({
  page,
}) => {
  let accountEmail = '';
  let submitted: any;
  await page.route('**/account/contact-email/set', async (route) => {
    accountEmail = route.request().postDataJSON().contactEmail;
    await route.fulfill({ json: { success: true, status: 'pending_verification' } });
  });
  await page.route('**/support/reports', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: receipt });
  });
  await page.getByText('Help', { exact: true }).click();
  await page.getByRole('button', { name: 'Report a problem', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Report a problem' });
  await dialog.getByRole('textbox', { name: 'What went wrong?' }).fill('A refused operation');
  await dialog.getByRole('button', { name: 'Open account settings' }).click();
  await dialog.getByRole('textbox', { name: 'Account email address' }).fill('verified-contact@example.test');
  await dialog.getByRole('button', { name: 'Save account email' }).click();
  await expect(dialog.getByText('Verification requested.', { exact: false })).toBeVisible();
  expect(accountEmail).toBe('verified-contact@example.test');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByRole('button', { name: 'Check receipt' })).toBeVisible();
  expect(JSON.stringify(submitted)).not.toContain(accountEmail);
  expect(submitted.description).toBe('A refused operation');
});

test('a refused client operation remains in evidence even when a callback consumes the error', async ({ page }) => {
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const path = '/src/services/mutation/mutationRequest.ts';
    const { mutationRequest } = await load(path);
    await mutationRequest({
      methods: [{ method: 'addEvent', params: { event: { eventName: 'PRIVATE_ATTEMPT_SENTINEL' } } }],
      callback: () => undefined,
    });
  });
  let submitted: any;
  await page.route('**/support/reports', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: receipt });
  });
  await page.getByText('Help', { exact: true }).click();
  await page.getByRole('button', { name: 'Report a problem', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Report a problem' });
  await dialog.getByRole('textbox', { name: 'What went wrong?' }).fill('The create was refused');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByRole('button', { name: 'Check receipt' })).toBeVisible();
  expect(submitted.evidence.diagnostics.some((entry: any) => entry.method === 'addEvent')).toBe(true);
  expect(JSON.stringify(submitted)).not.toContain('PRIVATE_ATTEMPT_SENTINEL');
});

test('routine warnings do not offer reporting or add a second diagnostic; errors retain existing actions', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { tmxToast } = await load('/src/services/notifications/tmxToast.ts');
    const { recordSupportDiagnostic } = await load('/src/services/support/reportContext.ts');
    recordSupportDiagnostic('STALE_DATA');
    tmxToast({ message: 'Refresh data', intent: 'is-warning', duration: 0 });
  });
  await expect(page.getByText('Refresh data', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Report a problem', exact: true })).toHaveCount(0);
  const codes = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { recentSupportDiagnostics } = await load('/src/services/support/reportContext.ts');
    return recentSupportDiagnostics().map((item: any) => item.code);
  });
  expect(codes).toEqual(['STALE_DATA']);
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { tmxToast } = await load('/src/services/notifications/tmxToast.ts');
    tmxToast({
      message: 'Error with details',
      intent: 'is-danger',
      duration: 0,
      action: { text: 'Details', onClick() {} },
    });
  });
  await expect(page.getByText('Details', { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { tmxToast } = await load('/src/services/notifications/tmxToast.ts');
    tmxToast({ message: 'Unexpected failure', intent: 'is-danger', duration: 0 });
  });
  await page.getByText('Report a problem', { exact: true }).last().click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('isolation hides existing reporting actions, preserves an open draft and refuses direct API races', async ({
  page,
}) => {
  const traffic: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/support/reports')) traffic.push(request.url());
  });
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { tmxToast } = await load('/src/services/notifications/tmxToast.ts');
    tmxToast({ message: 'Failure before Warp', intent: 'is-danger', duration: 0 });
  });
  await expect(page.locator('.tmx-support-report-toast button:not(.delete)')).toBeVisible();
  await page.locator('#tmx-support-help summary').click();
  await page.locator('#tmx-support-help').getByRole('button', { name: 'Report a problem' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('textarea[name="description"]').fill('Preserved description');
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { setNetworkIsolation } = await load('/src/services/network/networkPolicy.ts');
    setNetworkIsolation(true);
  });
  await expect(dialog.getByRole('button', { name: 'Send report' })).toBeDisabled();
  await expect(dialog.getByRole('status').first()).toContainText('Time Warp');
  await expect(page.locator('.tmx-support-report-toast button:not(.delete)')).toBeHidden();
  const result = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { submitSupportReport, fetchSupportReceipt, accountContactRequest } = await load(
      '/src/services/support/reportApi.ts',
    );
    const calls = [
      () => submitSupportReport({}),
      () => fetchSupportReceipt('test'),
      () => accountContactRequest('read'),
    ];
    return Promise.all(
      calls.map((call) =>
        call().then(
          () => 'unexpected success',
          (error: any) => error.code,
        ),
      ),
    );
  });
  expect(result).toEqual(['NETWORK_ISOLATED', 'NETWORK_ISOLATED', 'NETWORK_ISOLATED']);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('#tmx-support-help summary').click();
  await expect(page.locator('#tmx-support-help button')).toBeHidden();
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { openProblemReport } = await load('/src/components/support/reportProblem.ts');
    const { tmxToast } = await load('/src/services/notifications/tmxToast.ts');
    const { invalidParticipantsModal } = await load('/src/components/modals/invalidParticipantsModal.ts');
    openProblemReport();
    tmxToast({ message: 'Warp-local failure', intent: 'is-danger', duration: 0 });
    invalidParticipantsModal({
      invalidParticipants: [{ participantId: 'local', participantName: 'Synthetic', errors: [{ error: 'age' }] }],
    });
  });
  await expect(page.locator('#tmx-support-dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Report a problem', exact: true })).toBeHidden();
  expect(traffic).toEqual([]);
});

test('reporting stays suppressed through actual Warp exit recovery and returns afterward', async ({ page }) => {
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { buildSchedulerDemoProfile } = await load('/src/pages/tournaments/schedulerDemoProfile.ts');
    const dev = (globalThis as any).dev;
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      ...buildSchedulerDemoProfile(),
      tournamentAttributes: { tournamentId: 'support-warp-source' },
    });
    tournamentRecord.isMock = false;
    delete tournamentRecord.parentOrganisation;
    await dev.load(tournamentRecord);
    dev.tournamentContext.router.navigate('/tournament/support-warp-source/scheduling');
  });
  await expect(page).toHaveURL(/support-warp-source\/scheduling/);
  await page.locator('#tmx-support-help summary').click();
  await page.locator('#tmx-support-help button').click();
  await page.getByRole('dialog').locator('textarea[name="description"]').fill('Draft before Warp entry');
  const entered = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { enterTimeWarp } = await load('/src/services/timeWarp/timeWarp.ts');
    return enterTimeWarp();
  });
  expect(entered).toBe(true);
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Send report' })).toBeDisabled();
  await expect(page.getByRole('dialog').locator('textarea[name="description"]')).toHaveValue('Draft before Warp entry');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { tmx2db } = await load('/src/services/storage/tmx2db.ts');
    const { exitTimeWarp } = await load('/src/services/timeWarp/timeWarp.ts');
    const original = tmx2db.findTournament;
    tmx2db.findTournament = async (...args: any[]) => {
      tmx2db.findTournament = original;
      const record = await original.apply(tmx2db, args);
      await new Promise<void>((resolve) => {
        (globalThis as any).releaseSupportRecovery = resolve;
      });
      return record;
    };
    exitTimeWarp();
  });
  await expect.poll(() => page.evaluate(() => typeof (globalThis as any).releaseSupportRecovery)).toBe('function');
  const recovering = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { networkIsIsolated } = await load('/src/services/network/networkPolicy.ts');
    const { getWarpSession } = await load('/src/services/timeWarp/warpState.ts');
    const { openProblemReport } = await load('/src/components/support/reportProblem.ts');
    openProblemReport();
    return {
      isolated: networkIsIsolated(),
      hasSession: !!getWarpSession(),
      decoration: document.documentElement.dataset.tmxTimeWarp,
    };
  });
  expect(recovering).toEqual({ isolated: true, hasSession: true, decoration: undefined });
  await expect(page.locator('#tmx-support-dialog')).toHaveCount(0);
  await page.locator('#tmx-support-help summary').click();
  await expect(page.locator('#tmx-support-help button')).toBeHidden();
  await page.evaluate(() => (globalThis as any).releaseSupportRecovery());
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const load = (path: string) => import(/* @vite-ignore */ path);
        const { networkIsIsolated } = await load('/src/services/network/networkPolicy.ts');
        return networkIsIsolated();
      }),
    )
    .toBe(false);
  await page.locator('#tmx-support-help summary').click();
  await page.locator('#tmx-support-help summary').click();
  await page.locator('#tmx-support-help button').click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Send report' })).toBeEnabled();
});

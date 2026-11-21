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

test('Help submits only description-safe evidence, preserves an idempotent retry and shows truthful contact/receipt states', async ({
  page,
}) => {
  const requests: any[] = [];
  await page.route('**/support/reports', async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (requests.length === 1) await route.abort('failed');
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
    const path = '/src/services/mutation/mutationRequest.ts';
    const { mutationRequest } = await import(path);
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

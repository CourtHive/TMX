import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { factoryVersion, fetchDeployedManifest, promptRefresh, tmxToast } = vi.hoisted(() => ({
  factoryVersion: vi.fn(),
  fetchDeployedManifest: vi.fn(),
  promptRefresh: vi.fn(),
  tmxToast: vi.fn(),
}));

vi.mock('tods-competition-factory', () => ({ version: factoryVersion }));
vi.mock('services/version/deployedManifest', () => ({ fetchDeployedManifest }));
vi.mock('services/version/refreshPrompt', () => ({ promptRefresh }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast }));
vi.mock('config/serverConfig', () => ({ serverConfig: { get: () => ({ socketPath: 'https://srv' }) } }));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({ socketLog: false }) } }));

import { checkFactoryVersion, resetFactoryVersionCheck } from './checkFactoryVersion';

function mockServerVersion(version: string | undefined, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 503,
    json: async () => ({ version }),
  }) as any;
}

describe('checkFactoryVersion', () => {
  beforeEach(() => {
    resetFactoryVersionCheck();
    factoryVersion.mockReturnValue('6.13.0');
    fetchDeployedManifest.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when client and server share major.minor (patch tolerated)', async () => {
    factoryVersion.mockReturnValue('6.13.0');
    mockServerVersion('6.13.5');

    await checkFactoryVersion();

    expect(fetchDeployedManifest).not.toHaveBeenCalled();
    expect(promptRefresh).not.toHaveBeenCalled();
    expect(tmxToast).not.toHaveBeenCalled();
  });

  it('does nothing when the server version cannot be fetched', async () => {
    mockServerVersion(undefined, false);

    await checkFactoryVersion();

    expect(promptRefresh).not.toHaveBeenCalled();
    expect(tmxToast).not.toHaveBeenCalled();
  });

  it('prompts a refresh when the deployed SPA bundles a factory aligned with the server', async () => {
    factoryVersion.mockReturnValue('6.13.0'); // this tab
    mockServerVersion('6.14.0'); // server upgraded
    fetchDeployedManifest.mockResolvedValue({ version: '8.16.0', factoryVersion: '6.14.0' }); // aligned deploy exists

    await checkFactoryVersion();

    expect(promptRefresh).toHaveBeenCalledTimes(1);
    expect(promptRefresh).toHaveBeenCalledWith(expect.stringContaining('6.14.0'));
    expect(tmxToast).not.toHaveBeenCalled();
  });

  it('shows a passive notice (no refresh) when the latest deploy still mismatches — the futile-refresh case', async () => {
    factoryVersion.mockReturnValue('6.13.0');
    mockServerVersion('6.14.0');
    fetchDeployedManifest.mockResolvedValue({ version: '8.15.0', factoryVersion: '6.13.0' }); // no aligned deploy

    await checkFactoryVersion();

    expect(promptRefresh).not.toHaveBeenCalled();
    expect(tmxToast).toHaveBeenCalledTimes(1);
    const arg = tmxToast.mock.calls[0][0];
    expect(arg.intent).toBe('is-warning');
    expect(arg.action).toBeUndefined(); // no Refresh CTA
    expect(arg.message).toContain('6.14.0'); // server engine version, server-ahead wording
  });

  it('reports server-behind wording when the deployed app is ahead of the server engine', async () => {
    factoryVersion.mockReturnValue('6.14.0'); // this tab
    mockServerVersion('6.13.0'); // server behind
    fetchDeployedManifest.mockResolvedValue({ version: '8.16.0', factoryVersion: '6.14.0' }); // latest deploy also ahead

    await checkFactoryVersion();

    expect(promptRefresh).not.toHaveBeenCalled();
    expect(tmxToast).toHaveBeenCalledTimes(1);
    expect(tmxToast.mock.calls[0][0].message).toContain('server is being updated');
  });

  it('falls back to prompting a refresh when the deployed factory version is unknown', async () => {
    factoryVersion.mockReturnValue('6.13.0');
    mockServerVersion('6.14.0');
    fetchDeployedManifest.mockResolvedValue({ version: '8.15.0' }); // no factoryVersion field (older manifest)

    await checkFactoryVersion();

    expect(promptRefresh).toHaveBeenCalledTimes(1);
    expect(tmxToast).not.toHaveBeenCalled();
  });

  it('dedupes the passive notice per server version', async () => {
    factoryVersion.mockReturnValue('6.13.0');
    mockServerVersion('6.14.0');
    fetchDeployedManifest.mockResolvedValue({ version: '8.15.0', factoryVersion: '6.13.0' });

    await checkFactoryVersion();
    await checkFactoryVersion();

    expect(tmxToast).toHaveBeenCalledTimes(1);
  });
});

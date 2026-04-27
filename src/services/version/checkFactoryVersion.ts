/**
 * Verify the bundled factory version matches the server's factory version
 * on the major.minor axis. Patch differences are tolerated.
 *
 * Re-runs on each fresh socket connection so a server upgrade mid-session
 * is caught after the next reconnect.
 */
import { tmxToast } from 'services/notifications/tmxToast';
import { version as factoryVersion } from 'tods-competition-factory';
import { serverConfig } from 'config/serverConfig';
import { debugConfig } from 'config/debugConfig';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

let lastWarnedServerVersion: string | undefined;

function parseMajorMinor(v: string | undefined): { major: number; minor: number } | null {
  if (!v) return null;
  const m = /^(\d+)\.(\d+)/.exec(v);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]) };
}

export async function checkFactoryVersion(): Promise<void> {
  const base = serverConfig.get().socketPath || globalThis.location.origin;
  const url = `${base}/factory/version`;

  let serverVersion: string | undefined;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      slog('[version] /factory/version returned', res.status);
      return;
    }
    const body = await res.json();
    serverVersion = body?.version;
  } catch (err) {
    slog('[version] /factory/version fetch failed:', err);
    return;
  }

  const client = parseMajorMinor(factoryVersion());
  const server = parseMajorMinor(serverVersion);
  if (!client || !server) return;

  if (client.major === server.major && client.minor === server.minor) return;
  if (lastWarnedServerVersion === serverVersion) return;
  lastWarnedServerVersion = serverVersion;

  const message = `Factory version mismatch — server ${serverVersion}, client ${factoryVersion()}. Please refresh.`;
  console.warn('[version]', message);
  tmxToast({
    intent: 'is-warning',
    duration: 0,
    dismissible: true,
    pauseOnHover: true,
    message,
    action: { text: 'Refresh', onClick: () => globalThis.location.reload() },
  });
}

export function resetFactoryVersionCheck(): void {
  lastWarnedServerVersion = undefined;
}

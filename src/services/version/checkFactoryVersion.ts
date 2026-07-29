/**
 * Verify the bundled factory version matches the server's factory version on
 * the major.minor axis. Patch differences are tolerated.
 *
 * On a major/minor mismatch, decide whether a refresh can actually resolve it
 * by consulting the deployed `version.json` manifest (what a hard refresh would
 * load):
 *   - the latest-deployed SPA bundles a factory that aligns with the server
 *     → a refresh helps: prompt to refresh.
 *   - the latest-deployed SPA still bundles a mismatched factory
 *     → a refresh is futile (it re-serves the same bundle): show a passive,
 *       non-actionable notice instead of looping the user through reloads.
 *   - the deployed factory version can't be read (older deploy / fetch failure)
 *     → fall back to prompting a refresh rather than regressing the resolvable
 *       case.
 *
 * Re-runs on each fresh socket connection so a server upgrade mid-session is
 * caught after the next reconnect.
 */
import { version as factoryVersion } from 'tods-competition-factory';
import { fetchDeployedManifest } from 'services/version/deployedManifest';
import { promptRefresh } from 'services/version/refreshPrompt';
import { tmxToast } from 'services/notifications/tmxToast';
import { serverConfig } from 'config/serverConfig';
import { debugConfig } from 'config/debugConfig';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

let lastNoticedServerVersion: string | undefined;

interface MajorMinor {
  major: number;
  minor: number;
}

function parseMajorMinor(v: string | undefined): MajorMinor | null {
  if (!v) return null;
  const m = /^(\d+)\.(\d+)/.exec(v);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]) };
}

function sameMajorMinor(a: MajorMinor, b: MajorMinor): boolean {
  return a.major === b.major && a.minor === b.minor;
}

// -1 when a < b, 0 when equal, 1 when a > b (major.minor ordering).
function compareMajorMinor(a: MajorMinor, b: MajorMinor): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  return 0;
}

async function fetchServerFactoryVersion(): Promise<string | undefined> {
  const base = serverConfig.get().socketPath || globalThis.location.origin;
  const url = `${base}/factory/version`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      slog('[version] /factory/version returned', res.status);
      return undefined;
    }
    const body = await res.json();
    return body?.version;
  } catch (err) {
    slog('[version] /factory/version fetch failed:', err);
    return undefined;
  }
}

export async function checkFactoryVersion(): Promise<void> {
  const serverVersion = await fetchServerFactoryVersion();

  const client = parseMajorMinor(factoryVersion());
  const server = parseMajorMinor(serverVersion);
  if (!client || !server) return;

  // Aligned on major.minor (patch differences tolerated).
  if (sameMajorMinor(client, server)) return;

  // Mismatch. Would a refresh resolve it? Compare the server against the
  // factory version the latest-deployed SPA bundles (what a refresh loads).
  const { factoryVersion: deployedFactory } = await fetchDeployedManifest();
  const deployed = parseMajorMinor(deployedFactory);

  // Refresh helps only when the deployed SPA's factory aligns with the server.
  // If the deployed factory version is unknown (older manifest without the
  // field, or the manifest was unreachable), fall back to offering a refresh so
  // we don't regress the common resolvable case.
  const refreshResolves = !deployed || sameMajorMinor(deployed, server);

  if (refreshResolves) {
    promptRefresh(`A newer app version is available (competition engine ${serverVersion}). Refresh to update.`);
    return;
  }

  // Refresh is futile: the latest-deployed app still bundles a mismatched
  // engine. Show a passive, non-actionable notice (deduped per server version).
  if (lastNoticedServerVersion === serverVersion) return;
  lastNoticedServerVersion = serverVersion;

  // server ahead of the deployed app → an updated app is still being prepared;
  // server behind → the server is mid-upgrade. Either way the user can't fix it
  // by refreshing, so no Refresh action is offered.
  const serverAhead = compareMajorMinor(server, deployed) > 0;
  const message = serverAhead
    ? `This tournament is running a newer competition engine (${serverVersion}) than any available app build. An updated app is being prepared — some features may be unavailable until then.`
    : `The server is being updated to match this app's competition engine (${factoryVersion()}). Some features may be unavailable until it completes.`;
  console.warn('[version]', message);
  tmxToast({
    intent: 'is-warning',
    duration: 0,
    dismissible: true,
    pauseOnHover: true,
    message,
  });
}

export function resetFactoryVersionCheck(): void {
  lastNoticedServerVersion = undefined;
}

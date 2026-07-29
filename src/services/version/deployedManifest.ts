/**
 * Fetch TMX's build-emitted deploy manifest (`version.json`) — a description of
 * the SPA a hard refresh would load: its SPA `version` and the `factoryVersion`
 * it bundles. Emitted by the Vite plugin in `vite.config.ts`.
 *
 * Both fields may be absent when read from a deploy that predates the field
 * (older `version.json` carried only `version` + `builtAt`); callers must treat
 * `undefined` as "unknown", not "mismatched".
 */
import { debugConfig } from 'config/debugConfig';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

export interface DeployedManifest {
  version?: string;
  factoryVersion?: string;
}

export async function fetchDeployedManifest(): Promise<DeployedManifest> {
  const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      slog('[version] version.json returned', res.status);
      return {};
    }
    const body = await res.json();
    return {
      version: typeof body?.version === 'string' ? body.version : undefined,
      factoryVersion: typeof body?.factoryVersion === 'string' ? body.factoryVersion : undefined,
    };
  } catch (err) {
    slog('[version] version.json fetch failed:', err);
    return {};
  }
}

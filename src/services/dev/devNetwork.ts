import { createServerSocket } from 'services/network/serverNetwork';
import { scoreRelayApi } from 'services/apis/scoreRelayApi';
import { baseApi } from 'services/apis/baseApi';

/**
 * The app's own network clients, published on `dev.network` by setDev.
 *
 * Guidon's time-warp journey calls each one to prove Time Warp's network isolation refuses it (NETWORK_ISOLATED).
 * It used to import them by source path (`/src/services/apis/baseApi.ts`), which only the Vite dev server serves; a
 * built bundle has no such URL, so the journeys could not run against a build. These are the very instances the app
 * uses, never copies or wrappers: isolation proven on a copy would say nothing about the app's real clients.
 */
export const devNetwork = { baseApi, scoreRelayApi, createServerSocket };

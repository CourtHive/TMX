/**
 * Service worker registration.
 *
 * ── What this file used to be, and why none of it ran ──
 *
 * Create React App boilerplate, carried forward through the Vite migration and
 * never exercised. `main.ts` called `unregister()` unconditionally — with a
 * comment saying `register()` was "used for production", which nothing did — and
 * three things would have stopped it working if anything had:
 *
 *   1. **No worker existed.** Nothing in the build emitted `service-worker.js`,
 *      so registration would have fetched a 404.
 *   2. **The URL came from `PUBLIC_URL`, which means something else here.**
 *      `getPublicBaseUrl()` uses that variable for the base URL of the *public
 *      viewer* — a different origin or path from TMX. CRA reads it as TMX's own
 *      asset base, so registration either bailed on the origin check or looked
 *      for the worker inside another app.
 *   3. **`checkValidServiceWorker` had its test inverted**, unregistering when
 *      the response *was* valid JavaScript.
 *
 * `vite-plugin-pwa` now emits `sw.js` (see `vite.config.ts`), the URL is derived
 * from the app's own base the way `deployedManifest.ts` derives `version.json`,
 * and the content-type test is the right way round.
 *
 * ── The flag, and why it is a kill-switch rather than an on-switch ──
 *
 * Registration is off unless `VITE_SERVICE_WORKER` is explicitly set. A service
 * worker is the one piece of a deployment that outlives the deployment: a bad
 * one pins users to a stale build and cannot be fixed by shipping new files,
 * because the stale worker is what decides whether they are fetched.
 *
 * So `configure()` is the only entry point, and it does BOTH jobs — registers
 * when the flag is on, unregisters when it is off. Turning the flag off and
 * redeploying therefore removes the worker from every client that loads the app,
 * rather than leaving whatever is installed in place forever. That is the
 * property worth having before the first one is installed, not after.
 *
 * Updates never apply under the operator: `registerType: 'prompt'` keeps a new
 * worker waiting, and `onUpdate` surfaces the existing `updateReady()` notice.
 * A tournament desk does not want its engine swapped mid-match.
 */

/** Emitted by `vite-plugin-pwa` at the app's base. */
const SW_FILENAME = 'sw.js';

const localhostRegex = /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/;

/**
 * Evaluated on call rather than at module load.
 *
 * It was a module-level constant, which meant importing this file read
 * `location` — so it could not be imported at all outside a browser, and the
 * decisions in it could not be tested. Nothing here should happen as a side
 * effect of being imported.
 */
function isLocalhost(): boolean {
  const hostname = globalThis.location?.hostname ?? '';
  return hostname === 'localhost' || hostname === '[::1]' || localhostRegex.test(hostname);
}

interface Config {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
}

/**
 * Whether this build should install a service worker.
 *
 * Opt-in by exact value rather than truthiness: an unset variable arrives as the
 * empty string and a misspelled one as `undefined`, and neither should read as
 * "yes". Exported for its own test — the whole safety argument rests on this
 * returning false by default.
 */
export function serviceWorkerEnabled(flag: string | undefined = import.meta.env.VITE_SERVICE_WORKER): boolean {
  return flag === 'true' || flag === '1';
}

/**
 * Where the worker lives — the app's own base, not `PUBLIC_URL`.
 *
 * Same derivation `deployedManifest.ts` uses for `version.json`: `BASE_URL` is
 * what Vite was built with, so it is correct whether TMX is served from the root
 * or from `/tmx/`, and it is the only value that also scopes the worker to this
 * app rather than to its neighbours on the same host.
 */
export function serviceWorkerUrl(base: string = import.meta.env.BASE_URL): string {
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}${SW_FILENAME}`;
}

/**
 * The single entry point: install the worker when the flag is on, remove it when
 * it is off. See the header on why "off" has to actively unregister.
 */
export function configure(config?: Config): void {
  if (serviceWorkerEnabled()) register(config);
  else unregister();
}

export function register(config?: Config): void {
  if (!('serviceWorker' in navigator)) return;

  globalThis.addEventListener('load', () => {
    const swUrl = serviceWorkerUrl();

    // On localhost the worker may simply not be there — the dev server does not
    // emit one unless `devOptions.enabled` is set — so check before registering
    // and clear anything stale if it is missing.
    if (isLocalhost()) checkValidServiceWorker(swUrl, config);
    else registerValidSW(swUrl, config);
  });
}

function registerValidSW(swUrl: string, config?: Config): void {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state !== 'installed') return;

          // A controller already present means this is an UPDATE: the new worker
          // is installed but waiting, and stays waiting until every tab closes
          // or something calls skipWaiting. `onUpdate` is what offers that
          // choice to the operator.
          if (navigator.serviceWorker.controller) config?.onUpdate?.(registration);
          else config?.onSuccess?.(registration);
        };
      };
    })
    .catch((error) => {
      console.error('[serviceWorker] registration failed', error);
    });
}

function checkValidServiceWorker(swUrl: string, config?: Config): void {
  fetch(swUrl)
    .then((response) => {
      const contentType = response.headers.get('content-type');
      // Missing, or served as something other than JavaScript — usually the dev
      // server answering with index.html. Drop any worker already installed and
      // reload, so a stale one from an earlier build cannot keep serving.
      //
      // The `!` is load-bearing and was absent for the life of this file: without
      // it, a VALID worker took the unregister branch.
      if (response.status === 404 || !contentType?.includes('javascript')) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            globalThis.location.reload();
          });
        });
        return;
      }
      registerValidSW(swUrl, config);
    })
    .catch(() => {
      // Offline at boot. Whatever is installed keeps serving, which is the whole
      // point; there is nothing to check against.
    });
}

export function unregister(): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((registration) => {
    registration.unregister();
  });
}

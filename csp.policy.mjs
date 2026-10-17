/**
 * TMX web Content Security Policy — the single source of truth.
 *
 * Shipped as `Content-Security-Policy-Report-Only` (CA, 2026-10-17): the browser enforces nothing, it
 * reports what it WOULD have blocked to `/csp-report` on CFS. Once the reports show only noise, the
 * same string ships as the enforcing header.
 *
 * Read by `vite.config.ts` (the dev server sends it, so the e2e journeys run under it) and printed for
 * nginx by `node csp.policy.mjs [extra-connect-origin ...]`; the `/tmx/` blocks in Mentat's
 * `infra/nginx` carry the printed string. Change it here, then re-print it there.
 *
 * Why each directive:
 * - script-src 'self': only the bundle and `theme-init.js` run; no inline code, no handlers, no eval.
 *   This is the directive that turns an `<img onerror>` that slipped past escaping into a report.
 * - style-src 'unsafe-inline': Tabulator, courthive-components and TMX set inline styles throughout.
 *   Google Fonts CSS is loaded by the theme service.
 * - img-src https: map tiles (openstreetmap, arcgisonline) and provider logos at arbitrary hosts.
 * - connect-src 'self': the API, Socket.IO, /relay/ and /query/ are same-origin behind nginx. A server
 *   on another origin (a LAN host, a local CFS) is passed in as an extra origin.
 * - worker-src/frame-src blob: PDF and print previews are built as blobs.
 */

const FONT_CSS = 'https://fonts.googleapis.com';
const FONT_FILES = 'https://fonts.gstatic.com';

/**
 * @param {{ connect?: string[]; reportUri?: string }} [options]
 * @returns {string}
 */
export function buildCsp({ connect = [], reportUri = '/csp-report' } = {}) {
  const directives = [
    ["default-src 'self'"],
    ["script-src 'self'"],
    [`style-src 'self' 'unsafe-inline' ${FONT_CSS}`],
    [`font-src 'self' data: ${FONT_FILES}`],
    ["img-src 'self' data: blob: https:"],
    [["connect-src 'self'", ...connect].join(' ')],
    ["worker-src 'self' blob:"],
    ["frame-src 'self' blob:"],
    ["media-src 'self' data: blob:"],
    ["manifest-src 'self'"],
    ["object-src 'none'"],
    ["base-uri 'none'"],
    ["form-action 'self'"],
    ["frame-ancestors 'self'"],
    reportUri ? [`report-uri ${reportUri}`] : [],
  ];
  return directives.flat().join('; ');
}

/** The dev server adds Vite's HMR socket and a local CFS / relay. */
export const DEV_CONNECT = ['ws://localhost:*', 'http://localhost:*', 'ws://127.0.0.1:*', 'http://127.0.0.1:*'];

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${buildCsp({ connect: process.argv.slice(2) })}\n`);
}

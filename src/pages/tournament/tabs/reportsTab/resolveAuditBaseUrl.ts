/**
 * Resolve the audit-worker base URL for the current environment.
 *
 * Production / dev hosts (courthive.net, dev.courthive.net) reach the
 * Audit-Worker via a same-origin `/audit/` NGINX reverse-proxy block —
 * port 8385 is firewalled, so any direct-port URL from the browser fails.
 * Local Vite dev (`localhost:5173`) has no NGINX in the loop, so fall back
 * to the direct 8385 port there. `override` (env.auditWorkerUrl) wins
 * in both cases.
 */
export function resolveAuditBaseUrl(origin: string, override?: string): string {
  if (override) return override;
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin);
  if (isLocalhost) return `${origin.replace(/:\d+$/, '')}:8385`;
  return `${origin}/audit`;
}

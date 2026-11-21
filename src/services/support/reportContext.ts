import { SupportDiagnosticBuffer, reportRoute } from './diagnostics';
import { getToken } from 'services/authentication/tokenManagement';
import { context } from 'services/context';
import { jwtDecode } from 'jwt-decode';

const buffer = new SupportDiagnosticBuffer();

/** Identity/provider comparison only. CFS authorizes every report independently. */
export function reportScope(): string {
  try {
    const token = getToken();
    if (!token) return '';
    const claims = jwtDecode<any>(token);
    const identity = claims.userId ?? claims.sub ?? claims.email;
    const selected =
      claims.providerId ??
      claims.provider?.organisationId ??
      (claims.providerIds?.length === 1 ? claims.providerIds[0] : '');
    const impersonated = context.provider?.organisationId ?? '';
    return identity ? JSON.stringify([identity, selected, impersonated]) : '';
  } catch {
    return '';
  }
}
let diagnosticFailures = 0;
export function recordSupportDiagnostic(code: unknown, method?: unknown) {
  try {
    buffer.record(reportScope(), { code, method, route: reportRoute(globalThis.location?.hash ?? '') });
    if (diagnosticFailures) console.warn('[support] diagnostic recording recovered');
    diagnosticFailures = 0;
  } catch {
    diagnosticFailures++;
    if (diagnosticFailures === 1 || diagnosticFailures % 50 === 0 || Number.isInteger(Math.log10(diagnosticFailures)))
      console.warn('[support] diagnostic recording unavailable');
  }
}
export function recentSupportDiagnostics() {
  return buffer.snapshot(reportScope());
}

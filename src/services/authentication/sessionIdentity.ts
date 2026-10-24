import { getToken } from './tokenManagement';
import { jwtDecode } from 'jwt-decode';

/** Identity comparison only, NEVER authorization. Expiry may be transient during silent refresh;
 * logout removes the token, while another account changes its identity. No expired token is granted access here.
 */
export function getSessionIdentity(): string | undefined {
  try {
    const token = getToken();
    if (!token) return undefined;
    const state = jwtDecode<{ userId?: string; sub?: string; email?: string }>(token);
    return state.userId ?? state.sub ?? state.email;
  } catch {
    return undefined;
  }
}

/** The signed-in email, lowercased, for the same identity-only comparisons. Never authorization. */
export function getSessionEmail(): string | undefined {
  try {
    const token = getToken();
    if (!token) return undefined;
    return jwtDecode<{ email?: string }>(token).email?.toLowerCase() || undefined;
  } catch {
    return undefined;
  }
}

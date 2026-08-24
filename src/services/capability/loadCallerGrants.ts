/**
 * Populates the scoped-grant mask for the tournament being opened.
 *
 * `canForResource` has shipped since TMX #1344 and every call to it has been a
 * no-op, because nothing ever called `setCallerGrants` — the mask was
 * permanently empty, which reads as "unrestricted". Adopting the scoped check at
 * call sites without this is decorative: it would look done and change nothing.
 *
 * ## Clearing first is the load-bearing part
 *
 * The mask is a module singleton, so the previous tournament's grants outlive
 * navigation. Clearing before the fetch means a failure leaves the user
 * UNRESTRICTED rather than restricted by a grant that applies to a different
 * tournament — which would hide controls they are entitled to, on a tournament
 * the grant never mentioned.
 *
 * That direction is deliberate throughout this layer: the server is
 * authoritative, so the worst a stale or missing mask causes is a control
 * offered and then refused. The opposite — a control wrongly withheld — has no
 * server-side correction at all.
 */
import { clearCallerGrants, setCallerGrants } from 'services/capability/scopeState';
import { baseApi } from 'services/apis/baseApi';

/**
 * Fetch the caller's own live grants for `tournamentId`.
 *
 * Resolves rather than rejects: an unreachable server, a deployment predating
 * the endpoint, or a `tournament_grants` table that has not been migrated all
 * mean the same thing to the client as they do to the gate — no scoped
 * restriction to apply.
 */
export async function loadCallerGrants(tournamentId?: string): Promise<void> {
  clearCallerGrants();
  if (!tournamentId) return;

  try {
    const result: any = await baseApi.post('/factory/my-grants', { tournamentId }, { silenceErrors: true } as any);
    // No array-shape guard here on purpose: `setCallerGrants` already normalizes
    // a non-array to empty, and a second copy of that rule was measurably dead —
    // neutering it changed no test, which is the definition of code that is not
    // doing anything.
    setCallerGrants(result?.data?.grants);
  } catch {
    // Already cleared — unrestricted, matching what the server's own gate
    // concludes when it cannot read the table.
  }
}

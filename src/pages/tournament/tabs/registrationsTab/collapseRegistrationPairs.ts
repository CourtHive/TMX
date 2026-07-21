import type { RegistrationEntry } from 'services/apis/registrationsApi';

/**
 * Collapse doubles registrations into display rows (decision #3): a COMPLETE pair —
 * both halves registered referencing the same `partnerInviteId`, both non-terminal —
 * becomes ONE row; a pending pair (only one side registered) or a terminal entry stays
 * individual. A partial / pending-partner pair row NEVER surfaces to the director.
 *
 * Pure + order-preserving: the pair row appears at the position of its first-seen half.
 * Completeness here is the display proxy (both sides present); CFS re-checks the invite
 * status authoritatively at accept.
 */
export interface RegistrationDisplayRow {
  kind: 'individual' | 'pair';
  entries: RegistrationEntry[];
  registrationIds: string[];
}

const NON_TERMINAL = new Set(['applied', 'accepted', 'seeded', 'waitlisted']);

function isPairEligible(entry: RegistrationEntry): boolean {
  return !!entry.partnerInviteId && NON_TERMINAL.has(entry.status);
}

export function collapseRegistrationPairs(entries: RegistrationEntry[]): RegistrationDisplayRow[] {
  const inviteCounts = new Map<string, number>();
  for (const entry of entries) {
    if (isPairEligible(entry)) {
      inviteCounts.set(entry.partnerInviteId as string, (inviteCounts.get(entry.partnerInviteId as string) ?? 0) + 1);
    }
  }

  const emitted = new Set<string>();
  const rows: RegistrationDisplayRow[] = [];
  for (const entry of entries) {
    const inviteId = entry.partnerInviteId as string | undefined;
    const complete = isPairEligible(entry) && (inviteCounts.get(inviteId as string) ?? 0) >= 2;
    if (!complete) {
      rows.push({ kind: 'individual', entries: [entry], registrationIds: [entry.registrationId] });
      continue;
    }
    if (emitted.has(inviteId as string)) continue; // second half — the pair row already emitted
    emitted.add(inviteId as string);
    const halves = entries.filter((e) => e.partnerInviteId === inviteId && isPairEligible(e)).slice(0, 2);
    rows.push({ kind: 'pair', entries: halves, registrationIds: halves.map((h) => h.registrationId) });
  }
  return rows;
}

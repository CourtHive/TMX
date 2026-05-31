/**
 * Pure helper that decides which RegistrationStatus is active given the
 * dropdown value chosen by the director. Extracted so it can be unit
 * tested without standing up the DOM.
 */
import type { RegistrationStatus } from 'services/apis/registrationsApi';

export type FilterValue = 'all' | 'open' | RegistrationStatus;

const OPEN_STATUSES: RegistrationStatus[] = ['applied', 'waitlisted'];

export function filterEntriesByValue<T extends { status: RegistrationStatus }>(entries: T[], value: FilterValue): T[] {
  if (value === 'all') return entries;
  if (value === 'open') return entries.filter((e) => OPEN_STATUSES.includes(e.status));
  return entries.filter((e) => e.status === value);
}

export function isOpenStatus(status: RegistrationStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

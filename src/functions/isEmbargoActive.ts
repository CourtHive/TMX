/**
 * Returns true if the given embargo date/time is still in the future.
 *
 * TODO: Replace with `publishingGovernor.isEmbargoed()` from
 * tods-competition-factory once available in a published release.
 * The factory version also validates the ISO date string format.
 */
export const isEmbargoActive = (embargo?: string): boolean =>
  !!embargo && new Date(embargo).getTime() > Date.now();

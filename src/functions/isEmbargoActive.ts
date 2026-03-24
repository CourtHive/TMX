/**
 * Returns true if the given embargo date/time is still in the future.
 */
export const isEmbargoActive = (embargo?: string): boolean =>
  !!embargo && new Date(embargo).getTime() > Date.now();

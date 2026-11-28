/** The value, or a thrown Error naming what was missing: narrows a test's lookup without a cast. */
export function defined<T>(value: T | null | undefined, what = 'value'): T {
  if (value === null || value === undefined) throw new Error(`expected ${what} to be defined`);
  return value;
}

/**
 * Composition of the live provider config with the demo overlay.
 *
 * Strictly narrowing: `false` in either input wins. There is no path by which
 * the overlay can turn something on.
 */
import type { ProviderPermissions } from '@courthive/provider-config';

import type { DemoPermissionOverride } from './demoState';

export function intersectPermissions(
  base: ProviderPermissions | undefined,
  overlay: DemoPermissionOverride,
): ProviderPermissions {
  const result: ProviderPermissions = { ...(base ?? {}) };
  for (const key of Object.keys(overlay) as (keyof ProviderPermissions)[]) {
    (result as Record<string, unknown>)[key as string] = false;
  }
  return result;
}

/**
 * Intersect an allowed-universe list.
 *
 * `getAllowedList` returns `[]` to mean **unrestricted**, so a naive
 * intersection with an empty base yields `[]` — i.e. MORE permissive, inverting
 * the intent. That is the fail-open shape architectural standard A3 bans, so the
 * empty base is special-cased: an empty base means "no restriction yet", and the
 * overlay becomes the restriction.
 */
export function intersectList(base: string[] | undefined, overlay: string[] | undefined): string[] {
  if (!overlay) return base ?? [];
  if (!base?.length) return overlay;
  return base.filter((value) => overlay.includes(value));
}

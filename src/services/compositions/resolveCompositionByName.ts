/**
 * Resolve a composition by name. User compositions (saved in IndexedDB
 * via `compositionBridge`) take precedence over builtin compositions
 * from `courthive-components`.
 *
 * Sync — reads from the user composition cache populated at TMX boot
 * by `loadUserCompositions()`. Returns `undefined` if no match.
 *
 * Per-render mutations (e.g. `composition.allDrawPositions` added by
 * the draw renderer) are constructed onto a per-name runtime cache so
 * the mutation pattern that builtin compositions rely on works for
 * user compositions too.
 */
import { compositions } from 'courthive-components';
import { getUserCompositionsSync } from 'pages/templates/compositionBridge';

const userRuntimeCache = new Map<string, any>();

export function resolveCompositionByName(name: string | undefined): any | undefined {
  if (!name) return undefined;

  if (userRuntimeCache.has(name)) return userRuntimeCache.get(name);

  const userComp = getUserCompositionsSync().find((c) => c.name === name);
  if (userComp) {
    const runtime: any = {
      theme: userComp.composition.theme,
      configuration: { ...(userComp.composition.configuration || {}) },
      compositionName: name,
    };
    if (userComp.composition.colors) {
      runtime.colors = { ...userComp.composition.colors };
    }
    userRuntimeCache.set(name, runtime);
    return runtime;
  }

  return (compositions as any)[name];
}

/**
 * Drop the runtime cache for a single user composition. Call after
 * saving or deleting the composition so the next resolve picks up
 * fresh state.
 */
export function invalidateUserComposition(name: string): void {
  userRuntimeCache.delete(name);
}

/**
 * Clear the entire user-composition runtime cache. Call after
 * `loadUserCompositions()` runs so the cache reflects the latest
 * IndexedDB snapshot.
 */
export function clearUserCompositionRuntimeCache(): void {
  userRuntimeCache.clear();
}

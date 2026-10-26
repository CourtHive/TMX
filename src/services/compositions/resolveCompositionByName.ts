/**
 * Resolve a composition by name. User compositions (saved in IndexedDB
 * via `compositionBridge`) take precedence over builtin compositions
 * from `courthive-components`.
 *
 * Sync — reads from the user composition cache populated at TMX boot
 * by `loadUserCompositions()`. Returns `undefined` if no match.
 *
 * For USER compositions, returns a FRESH runtime object on every call:
 * each caller gets its own copy of `configuration` and `colors`. This
 * is intentional — TMX render code mutates `composition.configuration`
 * in place (adding fields like `allDrawPositions`, scale attributes,
 * form-controlled toggles). Sharing the runtime object across modal
 * opens or draw renders would leak those mutations between unrelated
 * surfaces. The perf cost of constructing a small object is trivial.
 *
 * BUILTIN compositions get the same treatment: a fresh copy of the
 * `courthive-components` preset, never the singleton itself. Handing out
 * the singleton let one surface's in-place changes become every later
 * surface's preset — a saved Scoreboard's settings were pasted onto
 * Australian, National and the rest, for the life of the page.
 */
import { getUserCompositionsSync } from 'pages/templates/compositionBridge';
import { compositions } from 'courthive-components';

export function resolveCompositionByName(name: string | undefined): any | undefined {
  if (!name) return undefined;

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
    return runtime;
  }

  const builtin = (compositions as any)[name];
  return builtin ? copyComposition(builtin) : undefined;
}

/** A copy whose `configuration` and `colors` can be changed in place without touching the source. */
export function copyComposition(composition: any): any {
  return {
    ...composition,
    configuration: { ...(composition.configuration || {}) },
    ...(composition.colors ? { colors: { ...composition.colors } } : {}),
  };
}

/**
 * Retained as a stable no-op so callers (e.g. `compositionBridge.ts`)
 * can keep their invalidation calls even though the resolver no longer
 * caches across calls. Safe to remove once callers drop the import.
 */
export function clearUserCompositionRuntimeCache(): void {
  // no-op
}

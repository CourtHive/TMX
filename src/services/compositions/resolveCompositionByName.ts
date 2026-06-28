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
 * For BUILTIN compositions, returns the singleton from `courthive-
 * components` directly — the in-place mutation pattern is intended
 * there (matches existing TMX behavior).
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

  return (compositions as any)[name];
}

/**
 * Retained as a stable no-op so callers (e.g. `compositionBridge.ts`)
 * can keep their invalidation calls even though the resolver no longer
 * caches across calls. Safe to remove once callers drop the import.
 */
export function clearUserCompositionRuntimeCache(): void {
  // no-op
}

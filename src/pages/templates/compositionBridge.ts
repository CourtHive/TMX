import { compositions } from 'courthive-components';
import { tmx2db } from 'services/storage/tmx2db';

import type { SavedComposition } from 'courthive-components';

export interface CompositionCatalogItem {
  id: string;
  name: string;
  description?: string;
  source: 'builtin' | 'user';
  composition: SavedComposition;
}

// ── Builtins (lazy-loaded singleton) ──
let builtinItems: CompositionCatalogItem[] | null = null;

export function getBuiltinCompositions(): CompositionCatalogItem[] {
  builtinItems ??= Object.entries(compositions).map(([name, comp]) => {
    const cfg = comp.configuration || {};
    const enabledFlags = Object.entries(cfg)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    const description = enabledFlags.length ? enabledFlags.join(', ') : 'default';

    return {
      id: `builtin-${name}`,
      name,
      description,
      source: 'builtin' as const,
      composition: {
        compositionName: name,
        theme: comp.theme,
        configuration: cfg,
        version: 1,
      },
    };
  });
  return builtinItems;
}

// ── User compositions (cached for sync access) ──
let userCompositionCache: CompositionCatalogItem[] = [];

export async function loadUserCompositions(): Promise<CompositionCatalogItem[]> {
  userCompositionCache = await tmx2db.findAll('compositions');
  return userCompositionCache;
}

export function getUserCompositionsSync(): CompositionCatalogItem[] {
  return userCompositionCache;
}

export async function saveUserComposition(item: CompositionCatalogItem): Promise<void> {
  await tmx2db.modifyOrAddUnique('compositions', 'id', item.id, item);
  await loadUserCompositions(); // refresh cache
}

export async function deleteUserComposition(id: string): Promise<void> {
  await (tmx2db.dex as any).compositions.where('id').equals(id).delete();
  await loadUserCompositions(); // refresh cache
}

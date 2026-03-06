import { standardTemplates } from 'courthive-components';
import { tmx2db } from 'services/storage/tmx2db';

import type { TopologyTemplate } from 'courthive-components';

export interface TopologyCatalogItem {
  id: string;
  name: string;
  description?: string;
  source: 'builtin' | 'user';
  state: TopologyTemplate['state'];
}

let builtinItems: TopologyCatalogItem[] | null = null;

export function getBuiltinTopologies(): TopologyCatalogItem[] {
  builtinItems ??= standardTemplates.map((t, i) => ({
    id: `builtin-${i}`,
    name: t.name,
    description: t.description,
    source: 'builtin' as const,
    state: t.state,
  }));
  return builtinItems;
}

// Cached user topologies for synchronous access (e.g. draw type selector)
let userTopologyCache: TopologyCatalogItem[] = [];

export async function loadUserTopologies(): Promise<TopologyCatalogItem[]> {
  userTopologyCache = await tmx2db.findAll('topologies');
  return userTopologyCache;
}

export function getUserTopologiesSync(): TopologyCatalogItem[] {
  return userTopologyCache;
}

export async function saveUserTopology(item: TopologyCatalogItem): Promise<void> {
  await tmx2db.modifyOrAddUnique('topologies', 'id', item.id, item);
  await loadUserTopologies(); // refresh cache
}

export async function deleteUserTopology(id: string): Promise<void> {
  await (tmx2db.dex as any).topologies.where('id').equals(id).delete();
  await loadUserTopologies(); // refresh cache
}

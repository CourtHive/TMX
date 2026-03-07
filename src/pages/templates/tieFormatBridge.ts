import { fixtures } from 'tods-competition-factory';
import { tmx2db } from 'services/storage/tmx2db';

const { tieFormats: builtinFixtures } = fixtures;

export interface TieFormatCatalogItem {
  id: string;
  name: string;
  description?: string;
  source: 'builtin' | 'user';
  tieFormat: any;
}

let builtinItems: TieFormatCatalogItem[] | null = null;

export function getBuiltinTieFormats(): TieFormatCatalogItem[] {
  builtinItems ??= Object.entries(builtinFixtures).map(([key, tf]) => ({
    id: `builtin-${key}`,
    name: (tf as any).tieFormatName || key,
    description: summarizeTieFormat(tf),
    source: 'builtin' as const,
    tieFormat: tf,
  }));
  return builtinItems;
}

let userTieFormatCache: TieFormatCatalogItem[] = [];

export async function loadUserTieFormats(): Promise<TieFormatCatalogItem[]> {
  userTieFormatCache = await tmx2db.findAll('tieFormats');
  return userTieFormatCache;
}

export function getUserTieFormatsSync(): TieFormatCatalogItem[] {
  return userTieFormatCache;
}

export async function saveUserTieFormat(item: TieFormatCatalogItem): Promise<void> {
  await tmx2db.modifyOrAddUnique('tieFormats', 'id', item.id, item);
  await loadUserTieFormats();
}

export async function deleteUserTieFormat(id: string): Promise<void> {
  await (tmx2db.dex as any).tieFormats.where('id').equals(id).delete();
  await loadUserTieFormats();
}

function summarizeTieFormat(tf: any): string {
  if (!tf?.collectionDefinitions?.length) return 'Empty';
  const parts = tf.collectionDefinitions.map((c: any) => {
    const count = c.matchUpCount || 0;
    const type = c.collectionName || c.matchUpType || '?';
    return `${count} ${type}`;
  });
  const goal = tf.winCriteria?.valueGoal;
  return parts.join(', ') + (goal ? ` (win: ${goal})` : '');
}

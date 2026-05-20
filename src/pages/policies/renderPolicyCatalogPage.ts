/**
 * Public policy catalog browser. Fetches GET /policies/catalog from the
 * configured CFS instance and renders a read-only structured view of
 * each policy. Works without auth — the catalog endpoint returns
 * SHARED_DEMO + TEMPLATE_REF policies that are explicitly public.
 *
 * Routed at `/policies/catalog`. Linked from the main /policies page
 * via a "Browse public catalog" affordance.
 */
import { showTMXpolicies } from 'services/transitions/screenSlaver';
import { removeAllChildNodes } from 'services/dom/transformers';
import { homeNavigation } from 'homeNavigation';
import { TMX_POLICIES, POLICIES } from 'constants/tmxConstants';
import { serverConfig } from 'config/serverConfig';

interface CatalogPolicy {
  policyId: string;
  providerId: string | null;
  policyType: string;
  name: string;
  version: string;
  visibility: 'SHARED_DEMO' | 'TEMPLATE_REF' | string;
  definition: Record<string, any>;
  publishedAt: string;
}

export async function renderPolicyCatalogPage(): Promise<void> {
  showTMXpolicies();
  homeNavigation(POLICIES);

  const container = document.getElementById(TMX_POLICIES);
  if (!container) return;

  removeAllChildNodes(container);
  container.appendChild(buildIntro());

  const listEl = document.createElement('div');
  listEl.className = 'policy-catalog__list';
  listEl.style.cssText = 'display: flex; flex-direction: column; gap: .5rem; max-width: 60rem; margin: 1rem 0;';
  container.appendChild(listEl);

  const statusEl = document.createElement('div');
  statusEl.className = 'policy-catalog__status';
  statusEl.textContent = 'Loading…';
  container.appendChild(statusEl);

  try {
    const policies = await fetchCatalog();
    statusEl.remove();
    if (!policies.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: var(--tmx-text-secondary, #666); padding: 1rem;';
      empty.textContent = 'The catalog is empty.';
      listEl.appendChild(empty);
      return;
    }

    const grouped = groupByType(policies);
    for (const [policyType, group] of grouped) {
      listEl.appendChild(buildTypeSection(policyType, group));
    }
  } catch (err) {
    statusEl.style.cssText = 'color: var(--tmx-text-danger, #c00); padding: 1rem;';
    statusEl.textContent = `Failed to load catalog: ${(err as Error).message}`;
  }
}

function buildIntro(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'max-width: 60rem; margin: 1rem 0;';

  const heading = document.createElement('h2');
  heading.textContent = 'Public Policy Catalog';
  heading.style.cssText = 'margin: 0 0 .25rem 0;';
  wrap.appendChild(heading);

  const sub = document.createElement('div');
  sub.style.cssText = 'color: var(--tmx-text-secondary, #666); font-size: .9rem;';
  sub.textContent = 'Federation ranking-points policies anyone can browse. Read-only; copy the JSON to use as a starting template.';
  wrap.appendChild(sub);

  return wrap;
}

function buildTypeSection(policyType: string, policies: CatalogPolicy[]): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = 'display: flex; flex-direction: column; gap: .35rem;';

  const heading = document.createElement('h3');
  heading.textContent = humanizePolicyType(policyType);
  heading.style.cssText = 'margin: .75rem 0 .25rem 0; font-size: 1rem;';
  section.appendChild(heading);

  for (const policy of policies) {
    section.appendChild(buildPolicyCard(policy));
  }

  return section;
}

function buildPolicyCard(policy: CatalogPolicy): HTMLElement {
  const card = document.createElement('div');
  card.className = 'policy-catalog__card';
  card.style.cssText =
    'border: 1px solid var(--tmx-border, #ddd); border-radius: 6px; padding: .75rem; cursor: pointer; display: flex; flex-direction: column; gap: .25rem;';

  const top = document.createElement('div');
  top.style.cssText = 'display: flex; justify-content: space-between; align-items: baseline;';

  const name = document.createElement('div');
  name.style.cssText = 'font-weight: 600;';
  name.textContent = policy.name;
  top.appendChild(name);

  const meta = document.createElement('div');
  meta.style.cssText = 'font-size: .8rem; color: var(--tmx-text-secondary, #666);';
  meta.textContent = `v${policy.version}`;
  top.appendChild(meta);

  card.appendChild(top);

  const badges = document.createElement('div');
  badges.style.cssText = 'display: flex; gap: .35rem; font-size: .75rem;';
  badges.appendChild(buildBadge(policy.visibility, visibilityBadgeColor(policy.visibility)));
  if (policy.providerId) {
    badges.appendChild(buildBadge(`provider: ${policy.providerId}`, '#888'));
  }
  card.appendChild(badges);

  if ((policy.definition as any)?.policyName) {
    const desc = document.createElement('div');
    desc.style.cssText = 'font-size: .85rem; color: var(--tmx-text-secondary, #666);';
    desc.textContent = (policy.definition as any).policyName;
    card.appendChild(desc);
  }

  card.addEventListener('click', () => openDetailModal(policy));

  return card;
}

function buildBadge(label: string, color: string): HTMLElement {
  const badge = document.createElement('span');
  badge.style.cssText = `background: ${color}22; color: ${color}; border: 1px solid ${color}66; border-radius: 3px; padding: 1px .35rem;`;
  badge.textContent = label;
  return badge;
}

function visibilityBadgeColor(visibility: string): string {
  if (visibility === 'SHARED_DEMO') return '#268bd2';
  if (visibility === 'TEMPLATE_REF') return '#859900';
  return '#666';
}

function humanizePolicyType(policyType: string): string {
  if (policyType === 'rankingPoints') return 'Ranking points';
  return policyType;
}

function groupByType(policies: CatalogPolicy[]): Map<string, CatalogPolicy[]> {
  const grouped = new Map<string, CatalogPolicy[]>();
  for (const policy of policies) {
    const list = grouped.get(policy.policyType) ?? [];
    list.push(policy);
    grouped.set(policy.policyType, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }
  return grouped;
}

async function fetchCatalog(): Promise<CatalogPolicy[]> {
  const baseUrl = serverConfig.get().socketPath?.replace(/\/$/, '') ?? '';
  const response = await fetch(`${baseUrl}/policies/catalog`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const body = (await response.json()) as { policies?: CatalogPolicy[] };
  return Array.isArray(body?.policies) ? body.policies : [];
}

function openDetailModal(policy: CatalogPolicy): void {
  const backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 10000; display: flex; align-items: center; justify-content: center;';

  const modal = document.createElement('div');
  modal.style.cssText =
    'background: var(--tmx-panel-bg, #fff); color: var(--tmx-text-primary, #111); border-radius: 8px; max-width: 50rem; width: 90vw; max-height: 80vh; display: flex; flex-direction: column; padding: 1rem;';

  const header = document.createElement('div');
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: baseline; gap: .5rem; margin-bottom: .5rem;';
  const title = document.createElement('h3');
  title.textContent = `${policy.name} (v${policy.version})`;
  title.style.cssText = 'margin: 0;';
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => backdrop.remove());
  header.appendChild(closeBtn);

  modal.appendChild(header);
  modal.appendChild(buildSummary(policy));
  modal.appendChild(buildJsonView(policy));

  backdrop.appendChild(modal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.body.appendChild(backdrop);
}

function buildSummary(policy: CatalogPolicy): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display: flex; flex-direction: column; gap: .25rem; margin-bottom: .75rem; font-size: .9rem;';

  const rows: Array<[string, string]> = [
    ['Visibility', policy.visibility],
    ['Type', policy.policyType],
    ['Provider', policy.providerId ?? '(global)'],
    ['Published', policy.publishedAt?.slice(0, 10) ?? ''],
  ];

  const awardProfiles = policy.definition?.awardProfiles;
  if (Array.isArray(awardProfiles)) {
    rows.push(['Award profiles', String(awardProfiles.length)]);
  }

  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: .5rem;';
    const k = document.createElement('span');
    k.style.cssText = 'color: var(--tmx-text-secondary, #666); min-width: 8rem;';
    k.textContent = label;
    const v = document.createElement('span');
    v.textContent = value;
    row.appendChild(k);
    row.appendChild(v);
    wrap.appendChild(row);
  }

  return wrap;
}

function buildJsonView(policy: CatalogPolicy): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display: flex; flex-direction: column; gap: .35rem; min-height: 0; flex: 1;';

  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display: flex; justify-content: flex-end; gap: .35rem;';
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy as JSON';
  const copyStatus = document.createElement('span');
  copyStatus.style.cssText = 'font-size: .8rem; color: var(--tmx-text-secondary, #666); align-self: center;';

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(policy.definition, null, 2));
      copyStatus.textContent = 'Copied';
      setTimeout(() => (copyStatus.textContent = ''), 2000);
    } catch (err) {
      copyStatus.textContent = `Copy failed: ${(err as Error).message}`;
    }
  });

  toolbar.appendChild(copyStatus);
  toolbar.appendChild(copyBtn);
  wrap.appendChild(toolbar);

  const pre = document.createElement('pre');
  pre.style.cssText =
    'background: var(--tmx-code-bg, #f5f5f5); color: var(--tmx-text-primary, #111); padding: .75rem; border-radius: 4px; overflow: auto; font-size: .8rem; flex: 1; min-height: 12rem;';
  pre.textContent = JSON.stringify(policy.definition, null, 2);
  wrap.appendChild(pre);

  return wrap;
}

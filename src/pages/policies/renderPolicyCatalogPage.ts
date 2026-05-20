/**
 * Public policy catalog browser. Fetches GET /policies/catalog from the
 * configured CFS instance and renders a read-only structured view of
 * each policy. Works without auth — the catalog endpoint returns
 * SHARED_DEMO + TEMPLATE_REF policies that are explicitly public.
 *
 * Click a policy → modal with a structured summary (NOT raw JSON — end
 * users should never see JSON here). The primary action is "Save to my
 * policies" which writes the policy into the user's local catalog via
 * policyBridge.saveUserPolicy; they can then edit/apply it from the
 * /policies authoring page.
 *
 * Routed at `/policies/catalog`. Linked from /policies via a pill at
 * the top of the authoring page.
 */
import type { PolicyCatalogItem } from 'courthive-components';
import { showTMXpolicies } from 'services/transitions/screenSlaver';
import './policyCatalog.css';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tmxToast } from 'services/notifications/tmxToast';
import { homeNavigation } from 'homeNavigation';
import { TMX_POLICIES, POLICIES } from 'constants/tmxConstants';
import { serverConfig } from 'config/serverConfig';
import { context } from 'services/context';
import { saveUserPolicy } from './policyBridge';

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

  const page = document.createElement('div');
  page.className = 'policy-catalog__page';
  container.appendChild(page);

  page.appendChild(buildIntro());

  const listEl = document.createElement('div');
  listEl.className = 'policy-catalog__list';
  page.appendChild(listEl);

  const statusEl = document.createElement('div');
  statusEl.className = 'policy-catalog__status';
  statusEl.textContent = 'Loading…';
  page.appendChild(statusEl);

  try {
    const policies = await fetchCatalog();
    statusEl.remove();
    if (!policies.length) {
      const empty = document.createElement('div');
      empty.className = 'policy-catalog__empty';
      empty.textContent = 'The catalog is empty.';
      listEl.appendChild(empty);
      return;
    }

    const grouped = groupByType(policies);
    for (const [policyType, group] of grouped) {
      listEl.appendChild(buildTypeSection(policyType, group));
    }
  } catch (err) {
    statusEl.classList.add('policy-catalog__status--error');
    statusEl.textContent = `Failed to load catalog: ${(err as Error).message}`;
  }
}

function buildIntro(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'policy-catalog__intro';

  const actions = document.createElement('div');
  actions.className = 'policy-catalog__intro-actions';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'policy-catalog__entry-button';
  backBtn.textContent = '← Back to My Policies';
  backBtn.addEventListener('click', () => {
    context.router?.navigate(`/${POLICIES}`);
  });
  actions.appendChild(backBtn);
  wrap.appendChild(actions);

  const heading = document.createElement('h2');
  heading.textContent = 'Public Policy Catalog';
  wrap.appendChild(heading);

  const sub = document.createElement('div');
  sub.className = 'policy-catalog__intro-sub';
  sub.textContent =
    'Federation ranking-points policies anyone can browse. Open a policy and click “Save to my policies” to copy it into your local catalog where you can edit, attach, and apply it.';
  wrap.appendChild(sub);

  return wrap;
}

function buildTypeSection(policyType: string, policies: CatalogPolicy[]): HTMLElement {
  const section = document.createElement('div');
  section.className = 'policy-catalog__section';

  const heading = document.createElement('h3');
  heading.textContent = humanizePolicyType(policyType);
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'policy-catalog__grid';
  section.appendChild(grid);

  for (const policy of policies) {
    grid.appendChild(buildPolicyCard(policy));
  }

  return section;
}

function buildPolicyCard(policy: CatalogPolicy): HTMLElement {
  const card = document.createElement('div');
  card.className = 'policy-catalog__card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  const top = document.createElement('div');
  top.className = 'policy-catalog__card-top';

  const name = document.createElement('div');
  name.className = 'policy-catalog__card-name';
  name.textContent = policy.name;
  top.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'policy-catalog__card-meta';
  meta.textContent = `v${policy.version}`;
  top.appendChild(meta);

  card.appendChild(top);

  const badges = document.createElement('div');
  badges.className = 'policy-catalog__badges';
  badges.appendChild(buildBadge(policy.visibility, visibilityModifier(policy.visibility)));
  if (policy.providerId) {
    badges.appendChild(buildBadge(`provider: ${policy.providerId}`, 'provider'));
  }
  card.appendChild(badges);

  if ((policy.definition as any)?.policyName) {
    const desc = document.createElement('div');
    desc.className = 'policy-catalog__card-desc';
    desc.textContent = (policy.definition as any).policyName;
    card.appendChild(desc);
  }

  const open = () => openDetailModal(policy);
  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });

  return card;
}

function buildBadge(label: string, modifier: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `policy-catalog__badge policy-catalog__badge--${modifier}`;
  badge.textContent = label;
  return badge;
}

function visibilityModifier(visibility: string): string {
  if (visibility === 'SHARED_DEMO') return 'shared-demo';
  if (visibility === 'TEMPLATE_REF') return 'template-ref';
  return 'neutral';
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
  backdrop.className = 'policy-catalog__modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');

  const modal = document.createElement('div');
  modal.className = 'policy-catalog__modal';

  modal.appendChild(buildModalHeader(policy, backdrop));
  modal.appendChild(buildSummary(policy));
  modal.appendChild(buildFeatureList(policy));
  modal.appendChild(buildAwardProfiles(policy));
  modal.appendChild(buildModalActions(policy, backdrop));

  backdrop.appendChild(modal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);

  document.body.appendChild(backdrop);
}

function buildModalHeader(policy: CatalogPolicy, backdrop: HTMLElement): HTMLElement {
  const header = document.createElement('div');
  header.className = 'policy-catalog__modal-header';

  const title = document.createElement('h3');
  title.textContent = `${policy.name} `;
  const versionTag = document.createElement('span');
  versionTag.className = 'policy-catalog__modal-version';
  versionTag.textContent = `v${policy.version}`;
  title.appendChild(versionTag);
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'delete';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.addEventListener('click', () => backdrop.remove());
  header.appendChild(closeBtn);

  return header;
}

function buildSummary(policy: CatalogPolicy): HTMLElement {
  const wrap = document.createElement('dl');
  wrap.className = 'policy-catalog__summary';

  const rows: Array<[string, string]> = [
    ['Visibility', policy.visibility],
    ['Type', humanizePolicyType(policy.policyType)],
    ['Provider', policy.providerId ?? 'Global'],
    ['Published', policy.publishedAt?.slice(0, 10) ?? '—'],
  ];

  if ((policy.definition as any)?.policyName) {
    rows.unshift(['Name', (policy.definition as any).policyName]);
  }

  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    wrap.appendChild(dt);
    wrap.appendChild(dd);
  }

  return wrap;
}

function buildFeatureList(policy: CatalogPolicy): HTMLElement {
  const def = policy.definition ?? {};
  const features: string[] = [];

  if (def.requireWinForPoints) features.push('Requires at least one win for points');
  if (def.requireWinFirstRound) features.push('First-round losers earn no points');
  if (def.doublesAttribution === 'fullToEach') features.push('Doubles: each partner gets full points');
  if (def.doublesAttribution === 'splitEven') features.push('Doubles: split evenly between partners');
  if (Array.isArray(def.qualityWinProfiles) && def.qualityWinProfiles.length) {
    features.push(`${def.qualityWinProfiles.length} quality-win profile(s) with rank-based bonuses`);
  }
  if (def.aggregationRules) {
    const rules = def.aggregationRules;
    const buckets = Array.isArray(rules.countingBuckets) ? rules.countingBuckets.length : 0;
    const rolling = rules.rollingPeriodDays ? `${rules.rollingPeriodDays}-day window` : null;
    const fragments = [
      buckets ? `${buckets} counting bucket(s)` : null,
      rolling,
      rules.minCountableResults ? `min ${rules.minCountableResults} results` : null,
    ].filter(Boolean);
    if (fragments.length) features.push(`Aggregation: ${fragments.join(', ')}`);
  }

  if (!features.length) return document.createDocumentFragment() as unknown as HTMLElement;

  const wrap = document.createElement('div');
  wrap.className = 'policy-catalog__features';
  const heading = document.createElement('h4');
  heading.textContent = 'Features';
  wrap.appendChild(heading);

  const list = document.createElement('ul');
  for (const item of features) {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  }
  wrap.appendChild(list);
  return wrap;
}

function buildAwardProfiles(policy: CatalogPolicy): HTMLElement {
  const profiles = (policy.definition as any)?.awardProfiles;
  if (!Array.isArray(profiles) || !profiles.length) {
    return document.createDocumentFragment() as unknown as HTMLElement;
  }

  const wrap = document.createElement('div');
  wrap.className = 'policy-catalog__profiles';

  const heading = document.createElement('h4');
  heading.textContent = `Award profiles (${profiles.length})`;
  wrap.appendChild(heading);

  const table = document.createElement('table');
  table.className = 'policy-catalog__profile-table';

  const thead = document.createElement('thead');
  thead.innerHTML =
    '<tr><th>Profile</th><th>Event types</th><th>Draw types</th><th>Levels</th><th>Stages</th></tr>';
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const profile of profiles) {
    const tr = document.createElement('tr');
    tr.appendChild(td(profile.profileName ?? '—'));
    tr.appendChild(td(formatList(profile.eventTypes)));
    tr.appendChild(td(formatList(profile.drawTypes)));
    tr.appendChild(td(formatList(profile.levels)));
    tr.appendChild(td(formatList(profile.stages)));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);

  return wrap;
}

function td(text: string): HTMLElement {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

function formatList(value: any): string {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (value !== undefined && value !== null) return String(value);
  return '—';
}

function buildModalActions(policy: CatalogPolicy, backdrop: HTMLElement): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'policy-catalog__actions';

  const status = document.createElement('span');
  status.className = 'policy-catalog__action-status';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'button is-info';
  saveBtn.textContent = 'Save to my policies';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      const item: PolicyCatalogItem = {
        id: `catalog-${policy.name}-${policy.version}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        name: humanizeCopyName(policy),
        policyType: policy.policyType,
        source: 'user',
        description: (policy.definition as any)?.policyName ?? `Copied from ${policy.name} v${policy.version}`,
        policyData: policy.definition,
      };
      await saveUserPolicy(item);
      tmxToast({ message: `Saved ${policy.name} to your policies`, intent: 'is-success' });
      status.textContent = 'Saved — open My Policies to edit or apply.';
      saveBtn.disabled = true;
    } catch (err) {
      tmxToast({ message: `Save failed: ${(err as Error).message}`, intent: 'is-danger' });
      saveBtn.disabled = false;
    }
  });

  const openMyPoliciesBtn = document.createElement('button');
  openMyPoliciesBtn.type = 'button';
  openMyPoliciesBtn.className = 'button';
  openMyPoliciesBtn.textContent = 'Open My Policies';
  openMyPoliciesBtn.addEventListener('click', () => {
    backdrop.remove();
    context.router?.navigate(`/${POLICIES}`);
  });

  wrap.appendChild(status);
  wrap.appendChild(openMyPoliciesBtn);
  wrap.appendChild(saveBtn);

  return wrap;
}

function humanizeCopyName(policy: CatalogPolicy): string {
  const fromDefinition = (policy.definition as any)?.policyName;
  if (fromDefinition) return `${fromDefinition} (copy)`;
  return `${policy.name} (copy)`;
}

import { getBuiltinTopologies, loadUserTopologies, saveUserTopology, deleteUserTopology } from './topologyBridge';
import { getBuiltinTieFormats, loadUserTieFormats, saveUserTieFormat, deleteUserTieFormat } from './tieFormatBridge';
import { showTMXtemplates } from 'services/transitions/screenSlaver';
import { openModal } from 'components/modals/baseModal/baseModal';
import { removeAllChildNodes } from 'services/dom/transformers';
import { TopologyBuilderControl } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { editTieFormat } from 'components/overlays/editTieFormat.js/editTieFormat';
import { getMatchFormatLabels } from 'components/modals/matchFormatLabels';
import { getMatchUpFormatModal } from 'courthive-components';
import { homeNavigation } from 'homeNavigation';
import { context } from 'services/context';

import type { TopologyCatalogItem } from './topologyBridge';
import type { TieFormatCatalogItem } from './tieFormatBridge';
import type { TopologyState } from 'courthive-components';

// constants
import { TMX_TEMPLATES, TEMPLATES } from 'constants/tmxConstants';

const TPL_PANEL_TITLE = 'tpl-panel-title';
const BTN_SMALL_INFO = 'button is-small is-info';

// ── Shared state ──
type TemplateView = 'topologies' | 'tieFormats';
let activeView: TemplateView = 'topologies';

// ── Topology view state ──
let builderControl: TopologyBuilderControl | null = null;
let selectedItemId: string | null = null;

// Persistent DOM references
let layoutRoot: HTMLElement | null = null;
let catalogBody: HTMLElement | null = null;
let catalogMeta: HTMLElement | null = null;
let builderPanel: HTMLElement | null = null;
let builderBody: HTMLElement | null = null;
let builderHeader: HTMLElement | null = null;
let emptyEl: HTMLElement | null = null;

// ── Entry point ──
export async function renderTemplatesPage(): Promise<void> {
  showTMXtemplates();
  homeNavigation(TEMPLATES);

  const tmxButton = document.getElementById('provider');
  if (tmxButton) tmxButton.onclick = () => context.router?.navigate('/tournaments');

  const container = document.getElementById(TMX_TEMPLATES);
  if (!container) return;

  destroyBuilder();
  removeAllChildNodes(container);
  selectedItemId = null;

  // Nav chips row
  const chipsRow = document.createElement('div');
  chipsRow.className = 'tpl-nav-chips';

  const views: { key: TemplateView; label: string }[] = [
    { key: 'topologies', label: 'Topologies' },
    { key: 'tieFormats', label: 'Tie Formats' },
  ];

  const chips: HTMLButtonElement[] = [];
  for (const view of views) {
    const chip = document.createElement('button');
    chip.className = 'tpl-nav-chip';
    if (view.key === activeView) chip.classList.add('active');
    chip.textContent = view.label;
    chip.onclick = () => {
      activeView = view.key;
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      renderActiveView(contentArea);
    };
    chips.push(chip);
    chipsRow.appendChild(chip);
  }

  const contentArea = document.createElement('div');
  contentArea.className = 'tpl-content-area';

  container.appendChild(chipsRow);
  container.appendChild(contentArea);

  await renderActiveView(contentArea);
}

async function renderActiveView(contentArea: HTMLElement): Promise<void> {
  destroyBuilder();
  removeAllChildNodes(contentArea);
  selectedItemId = null;

  if (activeView === 'topologies') {
    const userTopologies = await loadUserTopologies();
    const builtins = getBuiltinTopologies();
    buildTopologyLayout(contentArea, builtins, userTopologies);
  } else {
    const userTieFormats = await loadUserTieFormats();
    const builtins = getBuiltinTieFormats();
    buildTieFormatLayout(contentArea, builtins, userTieFormats);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TOPOLOGY VIEW
// ═══════════════════════════════════════════════════════════════════════

function buildTopologyLayout(
  container: HTMLElement,
  builtins: TopologyCatalogItem[],
  userTopologies: TopologyCatalogItem[],
): void {
  layoutRoot = document.createElement('div');
  layoutRoot.className = 'tpl-layout';

  // ── Left panel: catalog ──
  const leftPanel = document.createElement('div');
  leftPanel.className = 'tpl-panel';

  const header = document.createElement('div');
  header.className = 'tpl-panel-header';

  const title = document.createElement('div');
  title.className = TPL_PANEL_TITLE;
  title.textContent = 'Topology Templates';

  catalogMeta = document.createElement('div');
  catalogMeta.className = 'tpl-panel-meta';

  const newBtn = document.createElement('button');
  newBtn.className = BTN_SMALL_INFO;
  newBtn.textContent = 'New';
  newBtn.onclick = () => selectTopologyItem(undefined);

  header.appendChild(title);
  header.appendChild(catalogMeta);
  header.appendChild(newBtn);
  leftPanel.appendChild(header);

  catalogBody = document.createElement('div');
  catalogBody.className = 'tpl-panel-body';
  leftPanel.appendChild(catalogBody);

  // ── Right panel: builder ──
  const rightPanel = document.createElement('div');
  rightPanel.className = 'tpl-panel';

  builderPanel = document.createElement('div');
  builderPanel.className = 'tpl-builder-panel';
  builderPanel.style.display = 'none';

  builderHeader = document.createElement('div');
  builderHeader.className = 'tpl-builder-header';

  builderBody = document.createElement('div');
  builderBody.className = 'tpl-builder-body';

  builderPanel.appendChild(builderHeader);
  builderPanel.appendChild(builderBody);

  emptyEl = document.createElement('div');
  emptyEl.className = 'tpl-empty';
  emptyEl.textContent = 'Select a template to view or click New';

  rightPanel.appendChild(builderPanel);
  rightPanel.appendChild(emptyEl);

  layoutRoot.appendChild(leftPanel);
  layoutRoot.appendChild(rightPanel);
  container.appendChild(layoutRoot);

  renderTopologyCatalog(builtins, userTopologies);
}

function renderTopologyCatalog(builtins: TopologyCatalogItem[], userTopologies: TopologyCatalogItem[]): void {
  if (!catalogBody || !catalogMeta) return;
  catalogBody.innerHTML = '';
  catalogMeta.textContent = `${builtins.length + userTopologies.length} templates`;

  const topologyMeta = (item: CatalogItem, container: HTMLElement) => {
    const t = item as TopologyCatalogItem;
    const info = document.createElement('span');
    info.textContent = `${t.state.nodes?.length || 0} structures, ${t.state.edges?.length || 0} links`;
    container.appendChild(info);
  };

  if (builtins.length) {
    catalogBody.appendChild(
      renderGroup('Default', builtins, false, topologyMeta, (item) => selectTopologyItem(item as TopologyCatalogItem, true)),
    );
  }
  if (userTopologies.length) {
    catalogBody.appendChild(
      renderGroup('Custom', userTopologies, true, topologyMeta, (item) => selectTopologyItem(item as TopologyCatalogItem, false), async (item) => {
        await deleteUserTopology(item.id);
        tmxToast({ message: `Deleted "${item.name}"`, intent: 'is-info' });
        renderTemplatesPage();
      }),
    );
  }
}

function selectTopologyItem(item: TopologyCatalogItem | undefined, readOnly?: boolean): void {
  selectedItemId = item?.id ?? null;
  destroyBuilder();

  catalogBody?.querySelectorAll('.tpl-card').forEach((el) => el.classList.remove('active'));
  if (selectedItemId) {
    catalogBody?.querySelectorAll('.tpl-card').forEach((el) => {
      const nameEl = el.querySelector('.tpl-card__name');
      if (nameEl?.textContent?.startsWith(item!.name)) el.classList.add('active');
    });
  }

  if (!builderPanel || !builderBody || !builderHeader || !emptyEl) return;

  builderPanel.style.display = 'flex';
  emptyEl.style.display = 'none';
  builderBody.innerHTML = '';
  builderHeader.innerHTML = '';

  const titleEl = document.createElement('div');
  titleEl.className = TPL_PANEL_TITLE;
  titleEl.textContent = item ? item.name : 'New Topology';
  builderHeader.appendChild(titleEl);

  if (item && !readOnly) {
    const useBtn = document.createElement('button');
    useBtn.className = 'button is-small is-info is-outlined';
    useBtn.textContent = 'Use as template';
    useBtn.onclick = () => selectTopologyAsTemplate(item);
    builderHeader.appendChild(useBtn);
  }

  let initialState: Partial<TopologyState> | undefined;
  if (item) {
    initialState = {
      ...item.state,
      selectedNodeId: null,
      selectedEdgeId: null,
    };
  }

  const editingId = item && item.source === 'user' ? item.id : undefined;

  builderControl = new TopologyBuilderControl({
    initialState,
    readOnly,
    hideTemplates: true,
    hideGenerate: true,
    onSaveTemplate: readOnly
      ? undefined
      : (state: TopologyState) => {
          handleTopologySave(state, editingId, item?.name);
        },
  });

  builderControl.render(builderBody);

  if (initialState) {
    builderControl.autoLayout();
  }
}

function selectTopologyAsTemplate(item: TopologyCatalogItem): void {
  destroyBuilder();

  if (!builderPanel || !builderBody || !builderHeader || !emptyEl) return;

  builderPanel.style.display = 'flex';
  emptyEl.style.display = 'none';
  builderBody.innerHTML = '';
  builderHeader.innerHTML = '';

  const titleEl = document.createElement('div');
  titleEl.className = TPL_PANEL_TITLE;
  titleEl.textContent = `${item.name} (copy)`;
  builderHeader.appendChild(titleEl);

  const initialState: Partial<TopologyState> = {
    ...item.state,
    selectedNodeId: null,
    selectedEdgeId: null,
    drawName: `${item.name} (copy)`,
  };

  builderControl = new TopologyBuilderControl({
    initialState,
    hideTemplates: true,
    hideGenerate: true,
    onSaveTemplate: (state: TopologyState) => {
      handleTopologySave(state);
    },
  });

  builderControl.render(builderBody);
  builderControl.autoLayout();
}

function handleTopologySave(state: TopologyState, editingId?: string, defaultName?: string): void {
  promptForName(defaultName || state.drawName || '', (name) => {
    const id = editingId || `user-${Date.now()}`;
    const item: TopologyCatalogItem = {
      id,
      name,
      description: `${state.nodes.length} structures, ${state.edges.length} links`,
      source: 'user',
      state: {
        drawName: name,
        nodes: state.nodes,
        edges: state.edges,
      },
    };

    saveUserTopology(item).then(() => {
      tmxToast({ message: `Template "${name}" saved`, intent: 'is-success' });
      renderTemplatesPage();
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════
// TIE FORMAT VIEW
// ═══════════════════════════════════════════════════════════════════════

function buildTieFormatLayout(
  container: HTMLElement,
  builtins: TieFormatCatalogItem[],
  userTieFormats: TieFormatCatalogItem[],
): void {
  layoutRoot = document.createElement('div');
  layoutRoot.className = 'tpl-layout';

  // ── Left panel: catalog ──
  const leftPanel = document.createElement('div');
  leftPanel.className = 'tpl-panel';

  const header = document.createElement('div');
  header.className = 'tpl-panel-header';

  const title = document.createElement('div');
  title.className = TPL_PANEL_TITLE;
  title.textContent = 'Tie Format Templates';

  catalogMeta = document.createElement('div');
  catalogMeta.className = 'tpl-panel-meta';

  const newBtn = document.createElement('button');
  newBtn.className = BTN_SMALL_INFO;
  newBtn.textContent = 'New';
  newBtn.onclick = () => selectTieFormatItem(undefined);

  header.appendChild(title);
  header.appendChild(catalogMeta);
  header.appendChild(newBtn);
  leftPanel.appendChild(header);

  catalogBody = document.createElement('div');
  catalogBody.className = 'tpl-panel-body';
  leftPanel.appendChild(catalogBody);

  // ── Right panel: editor / preview ──
  const rightPanel = document.createElement('div');
  rightPanel.className = 'tpl-panel';

  builderPanel = document.createElement('div');
  builderPanel.className = 'tpl-builder-panel';
  builderPanel.style.display = 'none';

  builderHeader = document.createElement('div');
  builderHeader.className = 'tpl-builder-header';

  builderBody = document.createElement('div');
  builderBody.className = 'tpl-builder-body';

  builderPanel.appendChild(builderHeader);
  builderPanel.appendChild(builderBody);

  emptyEl = document.createElement('div');
  emptyEl.className = 'tpl-empty';
  emptyEl.textContent = 'Select a tie format to view or click New';

  rightPanel.appendChild(builderPanel);
  rightPanel.appendChild(emptyEl);

  layoutRoot.appendChild(leftPanel);
  layoutRoot.appendChild(rightPanel);
  container.appendChild(layoutRoot);

  renderTieFormatCatalog(builtins, userTieFormats);
}

function tieFormatMeta(item: CatalogItem, container: HTMLElement): void {
  const tf = (item as TieFormatCatalogItem).tieFormat;
  if (!tf?.collectionDefinitions?.length) {
    const span = document.createElement('span');
    span.textContent = 'Empty';
    container.appendChild(span);
    return;
  }

  const cols = tf.collectionDefinitions;

  // Collect stats
  const genders = new Set<string>();
  const types = new Set<string>();
  let totalMatchUps = 0;

  for (const col of cols) {
    totalMatchUps += col.matchUpCount || 0;
    if (col.gender) genders.add(col.gender.toUpperCase());
    if (col.matchUpType) types.add(col.matchUpType.toUpperCase());
  }

  const badges = document.createElement('span');
  badges.className = 'tpl-tf-badges';

  // # collections
  appendBadge(badges, `${cols.length}C`, 'neutral');

  // gender chips
  if (genders.has('MALE')) appendBadge(badges, 'M', 'male');
  if (genders.has('FEMALE')) appendBadge(badges, 'F', 'female');
  if (genders.has('MIXED')) appendBadge(badges, 'X', 'mixed');

  // type chips
  if (types.has('SINGLES')) appendBadge(badges, 'S', 'neutral');
  if (types.has('DOUBLES')) appendBadge(badges, 'D', 'neutral');

  // total matchUps
  appendBadge(badges, `${totalMatchUps}`, 'count');

  container.appendChild(badges);
}

function appendBadge(parent: HTMLElement, text: string, theme: string): void {
  const badge = document.createElement('span');
  badge.className = `tpl-tf-badge tpl-tf-badge--${theme}`;
  badge.textContent = text;
  parent.appendChild(badge);
}

function renderTieFormatCatalog(builtins: TieFormatCatalogItem[], userTieFormats: TieFormatCatalogItem[]): void {
  if (!catalogBody || !catalogMeta) return;
  catalogBody.innerHTML = '';
  catalogMeta.textContent = `${builtins.length + userTieFormats.length} formats`;

  if (builtins.length) {
    catalogBody.appendChild(
      renderGroup('Default', builtins, false, tieFormatMeta, (item) => selectTieFormatItem(item as TieFormatCatalogItem, true)),
    );
  }
  if (userTieFormats.length) {
    catalogBody.appendChild(
      renderGroup('Custom', userTieFormats, true, tieFormatMeta, (item) => selectTieFormatItem(item as TieFormatCatalogItem, false), async (item) => {
        await deleteUserTieFormat(item.id);
        tmxToast({ message: `Deleted "${item.name}"`, intent: 'is-info' });
        renderTemplatesPage();
      }),
    );
  }
}

function selectTieFormatItem(item: TieFormatCatalogItem | undefined, readOnly?: boolean): void {
  selectedItemId = item?.id ?? null;
  destroyBuilder();

  catalogBody?.querySelectorAll('.tpl-card').forEach((el) => el.classList.remove('active'));
  if (selectedItemId) {
    catalogBody?.querySelectorAll('.tpl-card').forEach((el) => {
      const nameEl = el.querySelector('.tpl-card__name');
      if (nameEl?.textContent?.startsWith(item!.name)) el.classList.add('active');
    });
  }

  if (!builderPanel || !builderBody || !builderHeader || !emptyEl) return;

  builderPanel.style.display = 'flex';
  emptyEl.style.display = 'none';
  builderBody.innerHTML = '';
  builderHeader.innerHTML = '';

  // Header with title and action buttons
  const titleEl = document.createElement('div');
  titleEl.className = TPL_PANEL_TITLE;
  titleEl.textContent = item ? item.name : 'New Tie Format';
  builderHeader.appendChild(titleEl);

  const btnGroup = document.createElement('div');
  btnGroup.style.cssText = 'display:flex;gap:6px;';

  if (item && readOnly) {
    // "Use as template" button for builtins
    const copyBtn = document.createElement('button');
    copyBtn.className = 'button is-small is-info is-outlined';
    copyBtn.textContent = 'Use as template';
    copyBtn.onclick = () => openTieFormatEditor(structuredClone(item.tieFormat), `${item.name} (copy)`);
    btnGroup.appendChild(copyBtn);
  }

  if (!readOnly) {
    const editBtn = document.createElement('button');
    editBtn.className = BTN_SMALL_INFO;
    editBtn.textContent = item ? 'Edit' : 'Create';
    editBtn.onclick = () => {
      const tf = item ? structuredClone(item.tieFormat) : { collectionDefinitions: [], winCriteria: {} };
      openTieFormatEditor(tf, item?.name, item?.id);
    };
    btnGroup.appendChild(editBtn);
  }

  builderHeader.appendChild(btnGroup);

  // Preview the tieFormat in the builder body
  if (item) {
    renderTieFormatPreview(builderBody, item.tieFormat);
  }
}

function renderTieFormatPreview(container: HTMLElement, tieFormat: any): void {
  const wrap = document.createElement('div');
  wrap.className = 'tfp';

  // Win criteria header
  const goal = tieFormat.winCriteria?.valueGoal;
  const aggregate = tieFormat.winCriteria?.aggregateValue;
  const totalMatchUps = (tieFormat.collectionDefinitions || []).reduce(
    (sum: number, c: any) => sum + (c.matchUpCount || 0),
    0,
  );

  const summary = document.createElement('div');
  summary.className = 'tfp-summary';

  const addStat = (label: string, value: string | number) => {
    const stat = document.createElement('div');
    stat.className = 'tfp-stat';
    const valEl = document.createElement('div');
    valEl.className = 'tfp-stat__value';
    valEl.textContent = String(value);
    const labelEl = document.createElement('div');
    labelEl.className = 'tfp-stat__label';
    labelEl.textContent = label;
    stat.appendChild(valEl);
    stat.appendChild(labelEl);
    summary.appendChild(stat);
  };

  addStat('Collections', tieFormat.collectionDefinitions?.length || 0);
  addStat('Total Matches', totalMatchUps);
  addStat('Win Criteria', goal ? `First to ${goal}` : aggregate ? 'Aggregate' : 'None');

  wrap.appendChild(summary);

  // Collection cards
  if (tieFormat.collectionDefinitions?.length) {
    const grid = document.createElement('div');
    grid.className = 'tfp-grid';

    for (const col of tieFormat.collectionDefinitions) {
      const card = document.createElement('div');
      card.className = 'tfp-collection';

      // Card header with name and type badge
      const header = document.createElement('div');
      header.className = 'tfp-collection__header';

      const name = document.createElement('div');
      name.className = 'tfp-collection__name';
      name.textContent = col.collectionName || 'Unnamed';

      const typeBadge = document.createElement('span');
      const matchUpType = (col.matchUpType || '').toUpperCase();
      typeBadge.className = `tfp-type-badge tfp-type-badge--${matchUpType === 'DOUBLES' ? 'doubles' : 'singles'}`;
      typeBadge.textContent = matchUpType === 'DOUBLES' ? 'D' : 'S';

      header.appendChild(name);
      header.appendChild(typeBadge);
      card.appendChild(header);

      // Stats row
      const stats = document.createElement('div');
      stats.className = 'tfp-collection__stats';

      // Match count
      const countEl = document.createElement('div');
      countEl.className = 'tfp-collection__count';
      countEl.textContent = String(col.matchUpCount || 0);
      const countLabel = document.createElement('span');
      countLabel.className = 'tfp-collection__count-label';
      countLabel.textContent = (col.matchUpCount || 0) === 1 ? ' match' : ' matches';
      countEl.appendChild(countLabel);

      stats.appendChild(countEl);

      // Gender badge (if specified)
      if (col.gender) {
        const gender = col.gender.toUpperCase();
        const genderBadge = document.createElement('span');
        genderBadge.className = `tfp-gender-badge tfp-gender-badge--${gender === 'MALE' ? 'male' : gender === 'FEMALE' ? 'female' : 'mixed'}`;
        genderBadge.textContent = gender === 'MALE' ? 'Male' : gender === 'FEMALE' ? 'Female' : 'Mixed';
        stats.appendChild(genderBadge);
      }

      card.appendChild(stats);

      // Format pill
      if (col.matchUpFormat) {
        const formatRow = document.createElement('div');
        formatRow.className = 'tfp-collection__format';
        const pill = document.createElement('button');
        pill.className = 'tpl-format-pill';
        pill.textContent = col.matchUpFormat;
        pill.onclick = () =>
          getMatchUpFormatModal({
            existingMatchUpFormat: col.matchUpFormat,
            config: { labels: getMatchFormatLabels() },
          });
        formatRow.appendChild(pill);
        card.appendChild(formatRow);
      }

      // Award info
      const awardLabel = col.collectionValue != null
        ? 'Collection value'
        : col.scoreValue != null
          ? 'Score value'
          : col.setValue != null
            ? 'Set value'
            : 'Match value';
      const awardVal = col.collectionValue ?? col.scoreValue ?? col.setValue ?? col.matchUpValue;
      if (awardVal != null) {
        const award = document.createElement('div');
        award.className = 'tfp-collection__award';
        award.textContent = `${awardLabel}: ${awardVal}`;
        card.appendChild(award);
      }

      grid.appendChild(card);
    }

    wrap.appendChild(grid);
  } else {
    const empty = document.createElement('div');
    empty.className = 'tfp-empty';
    empty.textContent = 'No collection definitions';
    wrap.appendChild(empty);
  }

  container.appendChild(wrap);
}

function openTieFormatEditor(tieFormat: any, defaultName?: string, editingId?: string): void {
  editTieFormat({
    title: defaultName || 'New Tie Format',
    tieFormat,
    onClose: (result: any) => {
      if (!result) return;
      promptForName(result.tieFormatName || defaultName || '', (name) => {
        result.tieFormatName = name;
        const id = editingId || `user-${Date.now()}`;
        const item: TieFormatCatalogItem = {
          id,
          name,
          description: summarizeTieFormat(result),
          source: 'user',
          tieFormat: result,
        };
        saveUserTieFormat(item).then(() => {
          tmxToast({ message: `Tie format "${name}" saved`, intent: 'is-success' });
          renderTemplatesPage();
        });
      });
    },
  });
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

// ═══════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════

interface CatalogItem {
  id: string;
  name: string;
  source: 'builtin' | 'user';
}

function renderGroup(
  title: string,
  items: CatalogItem[],
  canDelete: boolean,
  renderMetaContent: (item: CatalogItem, container: HTMLElement) => void,
  onSelect: (item: CatalogItem) => void,
  onDelete?: (item: CatalogItem) => void,
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'tpl-group';

  const gh = document.createElement('div');
  gh.className = 'tpl-group-header';

  const chevron = document.createElement('span');
  chevron.className = 'tpl-group-chevron';
  chevron.textContent = '\u25BC';

  const label = document.createElement('span');
  label.textContent = `${title} (${items.length})`;

  gh.appendChild(chevron);
  gh.appendChild(label);

  const gb = document.createElement('div');
  gb.className = 'tpl-group-body';

  let collapsed = false;
  gh.addEventListener('click', () => {
    collapsed = !collapsed;
    chevron.textContent = collapsed ? '\u25B6' : '\u25BC';
    gb.style.display = collapsed ? 'none' : '';
  });

  for (const item of items) {
    gb.appendChild(renderCard(item, canDelete, renderMetaContent, onSelect, onDelete));
  }

  group.appendChild(gh);
  group.appendChild(gb);
  return group;
}

function renderCard(
  item: CatalogItem,
  canDelete: boolean,
  renderMetaContent: (item: CatalogItem, container: HTMLElement) => void,
  onSelect: (item: CatalogItem) => void,
  onDelete?: (item: CatalogItem) => void,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'tpl-card';
  if (item.id === selectedItemId) card.classList.add('active');

  const nameEl = document.createElement('div');
  nameEl.className = 'tpl-card__name';
  nameEl.textContent = item.name;

  const meta = document.createElement('div');
  meta.className = 'tpl-card__meta';

  const sourceBadge = document.createElement('span');
  sourceBadge.className = `tpl-source-badge ${item.source}`;
  sourceBadge.textContent = item.source;

  meta.appendChild(sourceBadge);
  renderMetaContent(item, meta);

  card.appendChild(nameEl);
  card.appendChild(meta);

  card.addEventListener('click', () => onSelect(item));

  if (canDelete && onDelete) {
    const del = document.createElement('span');
    del.textContent = '\u00D7';
    del.title = 'Delete';
    del.style.cssText = 'float:right;cursor:pointer;font-weight:bold;color:var(--sp-err-text,#f14668);padding:0 4px;';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      onDelete(item);
    });
    nameEl.appendChild(del);
  }

  return card;
}

function promptForName(defaultValue: string, onConfirm: (name: string) => void): void {
  let nameInput: HTMLInputElement;

  const content = (elem: HTMLElement) => {
    const label = document.createElement('label');
    label.textContent = 'Template name';
    label.style.cssText = 'display:block;margin-bottom:6px;font-weight:600;font-size:13px;';
    elem.appendChild(label);

    nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'input';
    nameInput.value = defaultValue;
    nameInput.placeholder = 'Enter template name...';
    nameInput.style.cssText = 'width:100%;';
    elem.appendChild(nameInput);

    setTimeout(() => {
      nameInput.focus();
      nameInput.select();
    }, 100);
  };

  const buttons = [
    { label: 'Cancel', intent: 'is-light', close: true },
    {
      label: 'Save',
      intent: 'is-info',
      close: true,
      onClick: () => {
        const name = nameInput?.value?.trim();
        if (!name) {
          tmxToast({ message: 'Please enter a name', intent: 'is-warning' });
          return;
        }
        onConfirm(name);
      },
    },
  ];

  openModal({ title: 'Save Template', content, buttons });
}

function destroyBuilder(): void {
  if (builderControl) {
    builderControl.destroy();
    builderControl = null;
  }
}

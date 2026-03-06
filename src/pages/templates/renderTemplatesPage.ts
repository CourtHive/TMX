import { TopologyBuilderControl } from 'courthive-components';
import { showTMXtemplates } from 'services/transitions/screenSlaver';
import { removeAllChildNodes } from 'services/dom/transformers';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { homeNavigation } from 'homeNavigation';
import { context } from 'services/context';
import { TMX_TEMPLATES, TEMPLATES } from 'constants/tmxConstants';
import {
  getBuiltinTopologies,
  loadUserTopologies,
  saveUserTopology,
  deleteUserTopology,
} from './topologyBridge';

import type { TopologyCatalogItem } from './topologyBridge';
import type { TopologyState } from 'courthive-components';

let builderControl: TopologyBuilderControl | null = null;
let selectedItemId: string | null = null;

// Persistent DOM references for the two-column layout
let layoutRoot: HTMLElement | null = null;
let catalogBody: HTMLElement | null = null;
let catalogMeta: HTMLElement | null = null;
let builderPanel: HTMLElement | null = null;
let builderBody: HTMLElement | null = null;
let builderHeader: HTMLElement | null = null;
let emptyEl: HTMLElement | null = null;
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

  const userTopologies = await loadUserTopologies();
  const builtins = getBuiltinTopologies();

  buildLayout(container, builtins, userTopologies);
}

function buildLayout(
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
  title.className = 'tpl-panel-title';
  title.textContent = 'Topology Templates';

  catalogMeta = document.createElement('div');
  catalogMeta.className = 'tpl-panel-meta';

  const newBtn = document.createElement('button');
  newBtn.className = 'button is-small is-info';
  newBtn.textContent = 'New';
  newBtn.onclick = () => selectItem(undefined);

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

  renderCatalogItems(builtins, userTopologies);
}

function renderCatalogItems(builtins: TopologyCatalogItem[], userTopologies: TopologyCatalogItem[]): void {
  if (!catalogBody || !catalogMeta) return;
  catalogBody.innerHTML = '';
  catalogMeta.textContent = `${builtins.length + userTopologies.length} templates`;

  if (builtins.length) {
    catalogBody.appendChild(renderGroup('Default', builtins, false));
  }
  if (userTopologies.length) {
    catalogBody.appendChild(renderGroup('Custom', userTopologies, true));
  }
}

function renderGroup(title: string, items: TopologyCatalogItem[], canDelete: boolean): HTMLElement {
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
    gb.appendChild(renderCard(item, canDelete));
  }

  group.appendChild(gh);
  group.appendChild(gb);
  return group;
}

function renderCard(item: TopologyCatalogItem, canDelete: boolean): HTMLElement {
  const card = document.createElement('div');
  card.className = 'tpl-card';
  if (item.id === selectedItemId) card.classList.add('active');

  const nodeCount = item.state.nodes?.length || 0;
  const edgeCount = item.state.edges?.length || 0;

  const nameEl = document.createElement('div');
  nameEl.className = 'tpl-card__name';
  nameEl.textContent = item.name;

  const meta = document.createElement('div');
  meta.className = 'tpl-card__meta';

  const sourceBadge = document.createElement('span');
  sourceBadge.className = `tpl-source-badge ${item.source}`;
  sourceBadge.textContent = item.source;

  const info = document.createElement('span');
  info.textContent = `${nodeCount} structures, ${edgeCount} links`;

  meta.appendChild(sourceBadge);
  meta.appendChild(info);

  card.appendChild(nameEl);
  card.appendChild(meta);

  card.addEventListener('click', () => selectItem(item, !canDelete));

  // Delete on right-click context or via a small badge
  if (canDelete) {
    const del = document.createElement('span');
    del.textContent = '\u00D7';
    del.title = 'Delete';
    del.style.cssText = 'float:right;cursor:pointer;font-weight:bold;color:var(--sp-err-text,#f14668);padding:0 4px;';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteUserTopology(item.id);
      tmxToast({ message: `Deleted "${item.name}"`, intent: 'is-info' });
      renderTemplatesPage();
    });
    nameEl.appendChild(del);
  }

  return card;
}

function selectItem(item: TopologyCatalogItem | undefined, readOnly?: boolean): void {
  selectedItemId = item?.id ?? null;
  destroyBuilder();

  // Update active state on cards
  catalogBody?.querySelectorAll('.tpl-card').forEach((el) => el.classList.remove('active'));
  if (selectedItemId) {
    catalogBody?.querySelectorAll('.tpl-card').forEach((el) => {
      // Match by checking the card's text against the item name
      const nameEl = el.querySelector('.tpl-card__name');
      if (nameEl?.textContent?.startsWith(item!.name)) el.classList.add('active');
    });
  }

  if (!builderPanel || !builderBody || !builderHeader || !emptyEl) return;

  builderPanel.style.display = 'flex';
  emptyEl.style.display = 'none';
  builderBody.innerHTML = '';
  builderHeader.innerHTML = '';

  // Header
  const titleEl = document.createElement('div');
  titleEl.className = 'tpl-panel-title';
  titleEl.textContent = item ? item.name : 'New Topology';
  builderHeader.appendChild(titleEl);

  if (item && !readOnly) {
    const useBtn = document.createElement('button');
    useBtn.className = 'button is-small is-info is-outlined';
    useBtn.textContent = 'Use as template';
    useBtn.onclick = () => selectItemAsTemplate(item);
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
          handleSave(state, editingId, item?.name);
        },
  });

  builderControl.render(builderBody);

  if (initialState) {
    builderControl.autoLayout();
  }
}

function selectItemAsTemplate(item: TopologyCatalogItem): void {
  destroyBuilder();

  if (!builderPanel || !builderBody || !builderHeader || !emptyEl) return;

  builderPanel.style.display = 'flex';
  emptyEl.style.display = 'none';
  builderBody.innerHTML = '';
  builderHeader.innerHTML = '';

  const titleEl = document.createElement('div');
  titleEl.className = 'tpl-panel-title';
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
      handleSave(state);
    },
  });

  builderControl.render(builderBody);
  builderControl.autoLayout();
}

function handleSave(state: TopologyState, editingId?: string, defaultName?: string): void {
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

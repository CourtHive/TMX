import { editTournamentImage } from 'components/modals/tournamentImage';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { burstChart, fromFactoryDrawData } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { openNotesEditor } from './notesEditorModal';
import type { StructureInfo } from './dashboardData';
import { renderOverview } from './renderOverview';

// constants
import { SET_TOURNAMENT_NOTES } from 'constants/mutationConstants';

export function createImagePanel(imageUrl?: string): HTMLElement {
  const panel = document.createElement('div');
  panel.style.cssText =
    'border-radius:8px; overflow:hidden; cursor:pointer; display:flex; align-items:center; justify-content:center; min-height:200px; background:#f5f5f5;';

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.cssText = 'border-radius:8px; width:100%; object-fit:cover; max-height:300px;';
    img.alt = 'Tournament image';
    panel.appendChild(img);
    panel.style.background = '';
  } else {
    const placeholder = document.createElement('div');
    placeholder.style.cssText = 'text-align:center; color:#999; padding:24px;';
    placeholder.innerHTML =
      '<i class="fa fa-camera" style="font-size:48px; margin-bottom:8px; display:block;"></i>No tournament image';
    panel.appendChild(placeholder);
  }

  panel.addEventListener('click', () => {
    editTournamentImage({
      callback: () => renderOverview(),
    });
  });

  return panel;
}

export function createNotesPanel(notes?: string): HTMLElement {
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:relative; min-height:200px; border:1px solid #e0e0e0; border-radius:8px; padding:16px; overflow:auto; max-height:300px;';

  const notesView = document.createElement('div');
  notesView.className = 'ql-container ql-snow';
  notesView.style.border = 'none';
  notesView.innerHTML = notes ?? '';
  panel.appendChild(notesView);

  const editBtn = document.createElement('button');
  editBtn.style.cssText =
    'position:absolute; bottom:8px; right:8px; background:#fff; border:1px solid #ccc; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:14px;';
  editBtn.innerHTML = '<i class="fa fa-pencil"></i>';
  editBtn.title = 'Edit notes';
  editBtn.addEventListener('click', () => {
    openNotesEditor({
      notes,
      onSave: (html) => {
        mutationRequest({ methods: [{ method: SET_TOURNAMENT_NOTES, params: { notes: html } }] });
        notesView.innerHTML = html;
      },
    });
  });
  panel.appendChild(editBtn);

  return panel;
}

export function createStatCard(label: string, value: string | number, icon?: string): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = 'border-radius:8px; border:1px solid #e0e0e0; padding:12px 16px; min-width:0; background:#fff;';

  const valueEl = document.createElement('div');
  valueEl.style.cssText = 'font-size:1.5rem; font-weight:bold; margin-bottom:4px;';
  valueEl.textContent = String(value);
  card.appendChild(valueEl);

  const labelEl = document.createElement('div');
  labelEl.style.cssText = 'font-size:0.85rem; color:#666;';
  if (icon) {
    const iconEl = document.createElement('i');
    iconEl.className = `fa ${icon}`;
    iconEl.style.marginRight = '4px';
    labelEl.appendChild(iconEl);
  }
  labelEl.appendChild(document.createTextNode(label));
  card.appendChild(labelEl);

  return card;
}

export function createSunburstPanel(structures: StructureInfo[]): HTMLElement {
  const panel = document.createElement('div');
  panel.style.cssText = 'border-radius:8px; border:1px solid #e0e0e0; padding:16px;';

  // Dropdown selector
  const select = document.createElement('select');
  select.style.cssText = 'margin-bottom:12px; padding:4px 8px; border-radius:4px; border:1px solid #ccc;';

  for (const s of structures) {
    const option = document.createElement('option');
    option.value = s.structureId;
    option.textContent = `${s.eventName} — ${s.drawName} — ${s.structureName}`;
    select.appendChild(option);
  }

  panel.appendChild(select);

  const chartDiv = document.createElement('div');
  chartDiv.style.cssText = 'display:flex; justify-content:center;';
  panel.appendChild(chartDiv);

  const renderStructure = (structureId: string) => {
    const info = structures.find((s) => s.structureId === structureId);
    if (!info) return;

    // Fetch event data lazily — only for the selected event, not all events
    const eventData = tournamentEngine.getEventData({ eventId: info.eventId })?.eventData;
    const drawData = eventData?.drawsData
      ?.find((d: any) => d.drawId === info.drawId)
      ?.structures?.find((s: any) => s.structureId === structureId);
    if (!drawData) return;

    chartDiv.innerHTML = '';
    const title = `${info.eventName} — ${info.drawName}`;
    burstChart({ width: 500, height: 500 }).render(chartDiv, fromFactoryDrawData(drawData), title);
  };

  select.addEventListener('change', () => renderStructure(select.value));

  // Render first structure on load
  if (structures.length) {
    requestAnimationFrame(() => renderStructure(structures[0].structureId));
  }

  return panel;
}

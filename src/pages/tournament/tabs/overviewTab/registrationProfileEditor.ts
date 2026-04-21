import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { renderOverview } from './renderOverview';
import { t } from 'i18n';

import { SET_REGISTRATION_PROFILE } from 'constants/mutationConstants';

interface LogisticsOption {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  url?: string;
  priceRange?: string;
}

interface SocialEvent {
  name: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
}

interface Sponsor {
  name: string;
  tier?: string;
  logoUrl?: string;
  websiteUrl?: string;
}

const SPONSOR_TIERS = ['TITLE', 'PRESENTING', 'OFFICIAL', 'SUPPORTING'];
const ENTRY_METHODS = ['ONLINE', 'EMAIL', 'POSTAL', 'OTHER'];

const INPUT_STYLE =
  'width:100%; padding:6px 8px; border-radius:4px; border:1px solid var(--tmx-border-primary); background:var(--tmx-bg-primary); color:var(--tmx-text-primary); font-size:0.85rem;';
const LABEL_STYLE = 'display:block; font-size:0.8rem; color:var(--tmx-text-secondary); margin-bottom:2px;';
const SECTION_STYLE =
  'margin-bottom:16px; padding:12px; border-radius:6px; border:1px solid var(--tmx-border-primary);';
const SECTION_TITLE_STYLE = 'font-size:0.95rem; font-weight:600; margin-bottom:10px; display:flex; align-items:center; gap:6px;';

function createField(label: string, value: string, type = 'text'): { container: HTMLElement; input: HTMLInputElement } {
  const container = document.createElement('div');
  container.style.marginBottom = '8px';

  const lbl = document.createElement('label');
  lbl.style.cssText = LABEL_STYLE;
  lbl.textContent = label;
  container.appendChild(lbl);

  const input = document.createElement('input');
  input.type = type;
  input.style.cssText = INPUT_STYLE;
  input.value = value || '';
  container.appendChild(input);

  return { container, input };
}

function createSelect(label: string, options: string[], value: string): { container: HTMLElement; select: HTMLSelectElement } {
  const container = document.createElement('div');
  container.style.marginBottom = '8px';

  const lbl = document.createElement('label');
  lbl.style.cssText = LABEL_STYLE;
  lbl.textContent = label;
  container.appendChild(lbl);

  const select = document.createElement('select');
  select.style.cssText = INPUT_STYLE;

  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '-- Select --';
  select.appendChild(emptyOpt);

  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    if (opt === value) option.selected = true;
    select.appendChild(option);
  }
  container.appendChild(select);

  return { container, select };
}

function createTextarea(label: string, value: string, rows = 3): { container: HTMLElement; textarea: HTMLTextAreaElement } {
  const container = document.createElement('div');
  container.style.marginBottom = '8px';

  const lbl = document.createElement('label');
  lbl.style.cssText = LABEL_STYLE;
  lbl.textContent = label;
  container.appendChild(lbl);

  const textarea = document.createElement('textarea');
  textarea.style.cssText = `${INPUT_STYLE} resize:vertical;`;
  textarea.rows = rows;
  textarea.value = value || '';
  container.appendChild(textarea);

  return { container, textarea };
}

function createSection(title: string, icon: string): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = SECTION_STYLE;

  const header = document.createElement('div');
  header.style.cssText = SECTION_TITLE_STYLE;
  header.innerHTML = `<i class="fa ${icon}"></i> ${title}`;
  section.appendChild(header);

  return section;
}

function createLogisticsEditor(
  title: string,
  icon: string,
  existingOptions: LogisticsOption[],
  existingNotes: string,
): { section: HTMLElement; getOptions: () => LogisticsOption[]; getNotes: () => string } {
  const section = createSection(title, icon);
  let options = [...(existingOptions || [])];

  const listContainer = document.createElement('div');
  section.appendChild(listContainer);

  function renderList() {
    listContainer.innerHTML = '';
    options.forEach((opt, idx) => {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex; align-items:center; gap:6px; padding:4px 0; border-bottom:1px solid var(--tmx-border-primary);';

      const info = document.createElement('span');
      info.style.cssText = 'flex:1; font-size:0.85rem;';
      const details = [opt.phone, opt.email, opt.priceRange].filter(Boolean).join(' | ');
      const suffix = details ? ' — ' + details : '';
      info.textContent = opt.name + suffix;
      row.appendChild(info);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.style.cssText =
        'border:none; background:none; color:var(--tmx-text-danger, red); cursor:pointer; font-size:0.85rem;';
      removeBtn.innerHTML = '<i class="fa fa-times"></i>';
      removeBtn.addEventListener('click', () => {
        options.splice(idx, 1);
        renderList();
      });
      row.appendChild(removeBtn);

      listContainer.appendChild(row);
    });
  }

  renderList();

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.style.cssText =
    'margin:8px 0; padding:4px 10px; border-radius:4px; border:1px solid var(--tmx-border-primary); background:var(--tmx-bg-primary); color:var(--tmx-text-primary); cursor:pointer; font-size:0.8rem;';
  addBtn.innerHTML = '<i class="fa fa-plus"></i> Add';
  addBtn.addEventListener('click', () => {
    const nameInput = prompt('Name:');
    if (!nameInput?.trim()) return;
    const phone = prompt('Phone (optional):') || '';
    const email = prompt('Email (optional):') || '';
    const address = prompt('Address (optional):') || '';
    const priceRange = prompt('Price range (optional):') || '';
    const url = prompt('URL (optional):') || '';
    options.push({
      name: nameInput.trim(),
      ...(phone && { phone }),
      ...(email && { email }),
      ...(address && { address }),
      ...(priceRange && { priceRange }),
      ...(url && { url }),
    });
    renderList();
  });
  section.appendChild(addBtn);

  const { container: notesContainer, textarea: notesArea } = createTextarea('Additional notes (HTML)', existingNotes, 2);
  section.appendChild(notesContainer);

  return {
    section,
    getOptions: () => options,
    getNotes: () => notesArea.value,
  };
}

function createItemListEditor<T extends { name: string }>(
  title: string,
  icon: string,
  existingItems: T[],
  promptFn: () => T | null,
  displayFn: (item: T) => string,
): { section: HTMLElement; getItems: () => T[] } {
  const section = createSection(title, icon);
  let items = [...(existingItems || [])];

  const listContainer = document.createElement('div');
  section.appendChild(listContainer);

  function renderList() {
    listContainer.innerHTML = '';
    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex; align-items:center; gap:6px; padding:4px 0; border-bottom:1px solid var(--tmx-border-primary);';

      const info = document.createElement('span');
      info.style.cssText = 'flex:1; font-size:0.85rem;';
      info.textContent = displayFn(item);
      row.appendChild(info);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.style.cssText =
        'border:none; background:none; color:var(--tmx-text-danger, red); cursor:pointer; font-size:0.85rem;';
      removeBtn.innerHTML = '<i class="fa fa-times"></i>';
      removeBtn.addEventListener('click', () => {
        items.splice(idx, 1);
        renderList();
      });
      row.appendChild(removeBtn);

      listContainer.appendChild(row);
    });
  }

  renderList();

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.style.cssText =
    'margin:8px 0; padding:4px 10px; border-radius:4px; border:1px solid var(--tmx-border-primary); background:var(--tmx-bg-primary); color:var(--tmx-text-primary); cursor:pointer; font-size:0.8rem;';
  addBtn.innerHTML = '<i class="fa fa-plus"></i> Add';
  addBtn.addEventListener('click', () => {
    const item = promptFn();
    if (item) {
      items.push(item);
      renderList();
    }
  });
  section.appendChild(addBtn);

  return { section, getItems: () => items };
}

export function openRegistrationProfileEditor(): void {
  const { registrationProfile: profile } = tournamentEngine.getRegistrationProfile() as any;
  const rp = profile || {};

  const content = document.createElement('div');
  content.style.cssText = 'max-height:70vh; overflow-y:auto; padding-right:8px;';

  // --- Entry & Eligibility ---
  const entrySection = createSection('Entry & Eligibility', 'fa-ticket');

  const { container: openC, input: openI } = createField('Entries Open', rp.entriesOpen, 'date');
  const { container: closeC, input: closeI } = createField('Entries Close', rp.entriesClose, 'date');
  const { container: wdC, input: wdI } = createField('Withdrawal Deadline', rp.withdrawalDeadline, 'date');

  const dateRow = document.createElement('div');
  dateRow.style.cssText = 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;';
  dateRow.append(openC, closeC, wdC);
  entrySection.appendChild(dateRow);

  const { container: methodC, select: methodS } = createSelect('Entry Method', ENTRY_METHODS, rp.entryMethod || '');
  const { container: urlC, input: urlI } = createField('Entry URL', rp.entryUrl, 'url');
  const methodRow = document.createElement('div');
  methodRow.style.cssText = 'display:grid; grid-template-columns:1fr 2fr; gap:8px;';
  methodRow.append(methodC, urlC);
  entrySection.appendChild(methodRow);

  const { container: eligC, textarea: eligT } = createTextarea('Eligibility Notes', rp.eligibilityNotes, 2);
  entrySection.appendChild(eligC);
  content.appendChild(entrySection);

  // --- Logistics ---
  const accomEditor = createLogisticsEditor(
    'Accommodation',
    'fa-bed',
    rp.accommodation?.options || [],
    rp.accommodation?.notes || '',
  );
  content.appendChild(accomEditor.section);

  const transportEditor = createLogisticsEditor(
    'Transportation',
    'fa-car',
    rp.transportation?.options || [],
    rp.transportation?.notes || '',
  );
  content.appendChild(transportEditor.section);

  const hospEditor = createLogisticsEditor(
    'Hospitality',
    'fa-utensils',
    rp.hospitality?.options || [],
    rp.hospitality?.notes || '',
  );
  content.appendChild(hospEditor.section);

  const medEditor = createLogisticsEditor(
    'Medical',
    'fa-medkit',
    rp.medicalInfo?.options || [],
    rp.medicalInfo?.notes || '',
  );
  content.appendChild(medEditor.section);

  // --- Simple text ---
  const textSection = createSection('Other Details', 'fa-info-circle');
  const { container: dressC, input: dressI } = createField('Dress Code', rp.dressCode);
  const { container: contC, textarea: contT } = createTextarea('Contingency Plan', rp.contingencyPlan, 2);
  textSection.append(dressC, contC);
  content.appendChild(textSection);

  // --- Ceremony & Social ---
  const ceremonySection = createSection('Ceremonies & Social Events', 'fa-glass-cheers');
  const { container: drawCeremC, input: drawCeremI } = createField('Draw Ceremony Date', rp.drawCeremonyDate, 'datetime-local');
  const { container: awardCeremC, input: awardCeremI } = createField('Awards Ceremony Date', rp.awardsCeremonyDate, 'datetime-local');
  const ceremRow = document.createElement('div');
  ceremRow.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:8px;';
  ceremRow.append(drawCeremC, awardCeremC);
  ceremonySection.appendChild(ceremRow);

  const { container: awardsDescC, textarea: awardsDescT } = createTextarea('Awards Description', rp.awardsDescription, 2);
  ceremonySection.appendChild(awardsDescC);

  const socialEditor = createItemListEditor<SocialEvent>(
    'Social Events',
    'fa-calendar-alt',
    rp.socialEvents || [],
    () => {
      const name = prompt('Event name:');
      if (!name?.trim()) return null;
      const date = prompt('Date (optional, YYYY-MM-DD):') || '';
      const time = prompt('Time (optional, HH:MM):') || '';
      const location = prompt('Location (optional):') || '';
      const description = prompt('Description (optional):') || '';
      return {
        name: name.trim(),
        ...(date && { date }),
        ...(time && { time }),
        ...(location && { location }),
        ...(description && { description }),
      };
    },
    (e) => {
      const datePart = e.date ? ' (' + e.date + ')' : '';
      const locPart = e.location ? ' — ' + e.location : '';
      return e.name + datePart + locPart;
    },
  );
  ceremonySection.appendChild(socialEditor.section);
  content.appendChild(ceremonySection);

  // --- Sponsors ---
  const sponsorEditor = createItemListEditor<Sponsor>(
    'Sponsors',
    'fa-handshake',
    rp.sponsors || [],
    () => {
      const name = prompt('Sponsor name:');
      if (!name?.trim()) return null;
      const tier = prompt(`Tier (${SPONSOR_TIERS.join(', ')}):`) || '';
      const websiteUrl = prompt('Website URL (optional):') || '';
      return {
        name: name.trim(),
        ...(tier && { tier }),
        ...(websiteUrl && { websiteUrl }),
      };
    },
    (s) => s.name + (s.tier ? ' [' + s.tier + ']' : ''),
  );
  content.appendChild(sponsorEditor.section);

  // --- Regulations ---
  const regSection = createSection('Regulations', 'fa-gavel');
  const { container: cocNameC, input: cocNameI } = createField('Code of Conduct', rp.codeOfConduct?.name || '');
  const { container: cocUrlC, input: cocUrlI } = createField('Code of Conduct URL', rp.codeOfConduct?.url || '', 'url');
  const cocRow = document.createElement('div');
  cocRow.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:8px;';
  cocRow.append(cocNameC, cocUrlC);
  regSection.appendChild(cocRow);
  content.appendChild(regSection);

  // --- Save handler ---
  const handleSave = () => {
    const buildLogistics = (editor: { getOptions: () => LogisticsOption[]; getNotes: () => string }) => {
      const opts = editor.getOptions();
      const notes = editor.getNotes().trim();
      if (!opts.length && !notes) return undefined;
      return {
        ...(opts.length && { options: opts }),
        ...(notes && { notes }),
      };
    };

    const registrationProfile: any = {
      ...(openI.value && { entriesOpen: openI.value }),
      ...(closeI.value && { entriesClose: closeI.value }),
      ...(wdI.value && { withdrawalDeadline: wdI.value }),
      ...(methodS.value && { entryMethod: methodS.value }),
      ...(urlI.value && { entryUrl: urlI.value }),
      ...(eligT.value.trim() && { eligibilityNotes: eligT.value.trim() }),
      ...(dressI.value.trim() && { dressCode: dressI.value.trim() }),
      ...(contT.value.trim() && { contingencyPlan: contT.value.trim() }),
      ...(drawCeremI.value && { drawCeremonyDate: drawCeremI.value }),
      ...(awardCeremI.value && { awardsCeremonyDate: awardCeremI.value }),
      ...(awardsDescT.value.trim() && { awardsDescription: awardsDescT.value.trim() }),
    };

    const accommodation = buildLogistics(accomEditor);
    const transportation = buildLogistics(transportEditor);
    const hospitality = buildLogistics(hospEditor);
    const medicalInfo = buildLogistics(medEditor);

    if (accommodation) registrationProfile.accommodation = accommodation;
    if (transportation) registrationProfile.transportation = transportation;
    if (hospitality) registrationProfile.hospitality = hospitality;
    if (medicalInfo) registrationProfile.medicalInfo = medicalInfo;

    const socialEvents = socialEditor.getItems();
    if (socialEvents.length) registrationProfile.socialEvents = socialEvents;

    const sponsors = sponsorEditor.getItems();
    if (sponsors.length) registrationProfile.sponsors = sponsors;

    const cocName = cocNameI.value.trim();
    const cocUrl = cocUrlI.value.trim();
    if (cocName || cocUrl) {
      registrationProfile.codeOfConduct = {
        ...(cocName && { name: cocName }),
        ...(cocUrl && { url: cocUrl }),
      };
    }

    mutationRequest({
      methods: [{ method: SET_REGISTRATION_PROFILE, params: { registrationProfile } }],
    });

    closeModal();
    renderOverview();
  };

  openModal({
    title: 'Registration Profile',
    content,
    config: { maxWidth: 700, padding: '1' },
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('common.save'), intent: 'is-primary', onClick: handleSave },
    ],
  });
}

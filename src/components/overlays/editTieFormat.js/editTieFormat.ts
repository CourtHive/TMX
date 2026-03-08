/**
 * Edit tie format overlay with card-based collection editor.
 * Manages scorecard structure, win criteria, and collection configurations.
 */
import { tools, tournamentEngine } from 'tods-competition-factory';
import { getMatchFormatLabels } from 'components/modals/matchFormatLabels';
import { getMatchUpFormatModal } from 'courthive-components';
import { closeOverlay, openOverlay } from '../overlay';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { COLLECTION_VALUE, MATCH_VALUE, SCORE_VALUE, SET_VALUE } from 'constants/tmxConstants';

const AWARD_TYPES = [MATCH_VALUE, COLLECTION_VALUE, SET_VALUE, SCORE_VALUE];

type SelectOption = { value: string; label: string };
const getMatchTypes = (): SelectOption[] => [
  { value: 'Singles', label: t('formats.singles') },
  { value: 'Doubles', label: t('formats.doubles') },
];
const getGenders = (): SelectOption[] => [
  { value: 'Any', label: t('genders.any') },
  { value: 'Male', label: t('genders.male') },
  { value: 'Female', label: t('genders.female') },
  { value: 'Mixed', label: t('genders.mixed') },
];

interface CollectionRow {
  collectionName: string;
  collectionId: string;
  matchUpType: string;
  matchUpCount: number;
  matchUpFormat: string;
  gender: string;
  awardType: string;
  awardValue: number;
}

export function editTieFormat({ title, tieFormat, onClose }: { title: any; tieFormat: any; onClose: any }): any {
  const rows: CollectionRow[] = (tieFormat?.collectionDefinitions || []).map((col: any) => {
    const awardType =
      (col.collectionValue != null && COLLECTION_VALUE) ||
      (col.scoreValue != null && SCORE_VALUE) ||
      (col.setValue != null && SET_VALUE) ||
      MATCH_VALUE;
    const awardValue = col.collectionValue ?? col.scoreValue ?? col.setValue ?? col.matchUpValue ?? 1;
    return {
      collectionName: col.collectionName || '',
      collectionId: col.collectionId || tools.UUID(),
      matchUpType: capitalize(col.matchUpType || 'SINGLES'),
      matchUpCount: col.matchUpCount || 1,
      matchUpFormat: col.matchUpFormat || '',
      gender: capitalize(col.gender || 'ANY'),
      awardType,
      awardValue,
    };
  });

  let tieFormatName = tieFormat?.tieFormatName || 'Custom scorecard';
  let summaryEl: HTMLElement;
  let gridEl: HTMLElement;

  const constructTieFormat = () => {
    const collectionDefinitions = rows.map((row) =>
      tools.definedAttributes({
        collectionValue: row.awardType === COLLECTION_VALUE ? row.awardValue : undefined,
        matchUpValue: row.awardType === MATCH_VALUE ? row.awardValue : undefined,
        scoreValue: row.awardType === SCORE_VALUE ? row.awardValue : undefined,
        setValue: row.awardType === SET_VALUE ? row.awardValue : undefined,
        matchUpType: row.matchUpType.toUpperCase(),
        collectionName: row.collectionName,
        matchUpFormat: row.matchUpFormat,
        gender: row.gender.toUpperCase(),
        collectionId: row.collectionId,
        matchUpCount: row.matchUpCount,
      }),
    );
    const winCriteria = tournamentEngine.calculateWinCriteria({ collectionDefinitions });
    return { collectionDefinitions, tieFormatName, winCriteria };
  };

  const refresh = () => {
    renderSummary(summaryEl, rows, constructTieFormat().winCriteria);
    renderGrid(gridEl, rows, refresh);
  };

  // Build content
  const content = document.createElement('div');
  content.className = 'tfe';

  // Name input row
  const nameRow = document.createElement('div');
  nameRow.className = 'tfe-name-row';
  const nameLabel = document.createElement('label');
  nameLabel.className = 'tfe-name-label';
  nameLabel.textContent = 'Scorecard Name';
  const nameInput = document.createElement('input');
  nameInput.className = 'input tfe-name-input';
  nameInput.value = tieFormatName;
  nameInput.placeholder = 'Scorecard name';
  nameInput.oninput = () => {
    tieFormatName = nameInput.value;
  };
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  content.appendChild(nameRow);

  // Summary stats
  summaryEl = document.createElement('div');
  summaryEl.className = 'tfp-summary';
  content.appendChild(summaryEl);

  // Add collection button
  const addRow = document.createElement('div');
  addRow.className = 'tfe-add-row';
  const addBtn = document.createElement('button');
  addBtn.className = 'button is-small is-info';
  addBtn.textContent = 'Add Collection';
  addBtn.onclick = () => {
    rows.push({
      collectionName: `Collection ${rows.length + 1}`,
      collectionId: tools.UUID(),
      matchUpType: 'Singles',
      matchUpCount: 1,
      matchUpFormat: 'SET3-S:6/TB7',
      gender: 'Any',
      awardType: MATCH_VALUE,
      awardValue: 1,
    });
    refresh();
  };
  addRow.appendChild(addBtn);
  content.appendChild(addRow);

  // Collection cards grid
  gridEl = document.createElement('div');
  gridEl.className = 'tfp-grid';
  content.appendChild(gridEl);

  refresh();

  // Footer
  const footer = document.createElement('div');
  footer.className = 'overlay-footer-wrap';

  const cancel = document.createElement('button');
  cancel.className = 'button is-warning is-light';
  cancel.textContent = 'Cancel';
  cancel.onclick = () => closeOverlay();

  const done = document.createElement('button');
  done.className = 'button is-info button-spacer';
  done.textContent = 'Done';
  done.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeOverlay();
    if (isFunction(onClose)) {
      const tf = constructTieFormat();
      onClose(tf.collectionDefinitions?.length ? tf : null);
    }
  };

  footer.appendChild(cancel);
  footer.appendChild(done);

  return openOverlay({ title, content, footer });
}

function renderSummary(container: HTMLElement, rows: CollectionRow[], winCriteria: any): void {
  container.innerHTML = '';
  const totalMatchUps = rows.reduce((sum, r) => sum + (r.matchUpCount || 0), 0);
  const goal = winCriteria?.valueGoal;
  const aggregate = winCriteria?.aggregateValue;

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
    container.appendChild(stat);
  };

  addStat('Collections', rows.length);
  addStat('Total Matches', totalMatchUps);
  addStat('Win Criteria', goal ? `First to ${goal}` : aggregate ? 'Aggregate' : 'None');
}

function renderGrid(
  container: HTMLElement,
  rows: CollectionRow[],
  refresh: () => void,
): void {
  container.innerHTML = '';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const card = document.createElement('div');
    card.className = 'tfp-collection tfe-collection';

    // Header: editable name + type badge + delete button
    const header = document.createElement('div');
    header.className = 'tfp-collection__header';

    const nameInput = document.createElement('input');
    nameInput.className = 'tfe-inline-input tfe-inline-input--name';
    nameInput.value = row.collectionName;
    nameInput.placeholder = 'Collection name';
    nameInput.oninput = () => {
      row.collectionName = nameInput.value;
    };
    nameInput.onblur = () => refresh();

    const headerRight = document.createElement('div');
    headerRight.className = 'tfe-header-right';

    const isMixed = row.gender === 'Mixed';
    if (isMixed) row.matchUpType = 'Doubles';
    const typeSelect = createSelect(getMatchTypes(), row.matchUpType, (val) => {
      row.matchUpType = val;
      refresh();
    });
    typeSelect.className = 'tfe-inline-select tfe-inline-select--type';
    typeSelect.disabled = isMixed;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'tfe-delete-btn';
    deleteBtn.textContent = '\u00D7';
    deleteBtn.title = 'Remove collection';
    deleteBtn.onclick = () => {
      rows.splice(i, 1);
      refresh();
    };

    headerRight.appendChild(typeSelect);
    headerRight.appendChild(deleteBtn);
    header.appendChild(nameInput);
    header.appendChild(headerRight);
    card.appendChild(header);

    // Stats row: count, gender
    const stats = document.createElement('div');
    stats.className = 'tfp-collection__stats tfe-stats-row';

    const countGroup = document.createElement('div');
    countGroup.className = 'tfe-field-group';
    const countLabel = document.createElement('span');
    countLabel.className = 'tfe-field-label';
    countLabel.textContent = 'Matches';
    const countInput = document.createElement('input');
    countInput.type = 'number';
    countInput.className = 'tfe-inline-input tfe-inline-input--number';
    countInput.value = String(row.matchUpCount);
    countInput.min = '0';
    countInput.max = '20';
    countInput.oninput = () => {
      row.matchUpCount = parseInt(countInput.value) || 0;
    };
    countInput.onblur = () => refresh();
    countGroup.appendChild(countLabel);
    countGroup.appendChild(countInput);

    const genderGroup = document.createElement('div');
    genderGroup.className = 'tfe-field-group';
    const genderLabel = document.createElement('span');
    genderLabel.className = 'tfe-field-label';
    genderLabel.textContent = 'Gender';
    const genderSelect = createSelect(getGenders(), row.gender, (val) => {
      row.gender = val;
      if (val === 'Mixed') {
        row.matchUpType = 'Doubles';
      }
      refresh();
    });
    genderSelect.className = 'tfe-inline-select';
    genderGroup.appendChild(genderLabel);
    genderGroup.appendChild(genderSelect);

    stats.appendChild(countGroup);
    stats.appendChild(genderGroup);
    card.appendChild(stats);

    // Format row
    const formatRow = document.createElement('div');
    formatRow.className = 'tfp-collection__stats tfe-stats-row';

    const formatGroup = document.createElement('div');
    formatGroup.className = 'tfe-field-group';
    const formatLabel = document.createElement('span');
    formatLabel.className = 'tfe-field-label';
    formatLabel.textContent = 'Format';
    const formatPill = document.createElement('button');
    formatPill.className = 'tpl-format-pill';
    formatPill.textContent = row.matchUpFormat || 'Set format...';
    formatPill.onclick = () => {
      (getMatchUpFormatModal as any)({
        existingMatchUpFormat: row.matchUpFormat,
        config: { labels: getMatchFormatLabels() },
        callback: (matchUpFormat: string) => {
          if (matchUpFormat) {
            row.matchUpFormat = matchUpFormat;
            refresh();
          }
        },
      });
    };
    formatGroup.appendChild(formatLabel);
    formatGroup.appendChild(formatPill);

    const awardTypeGroup = document.createElement('div');
    awardTypeGroup.className = 'tfe-field-group';
    const awardTypeLabel = document.createElement('span');
    awardTypeLabel.className = 'tfe-field-label';
    awardTypeLabel.textContent = 'Award';
    const awardTypeSelect = createSelect(AWARD_TYPES, row.awardType, (val) => {
      row.awardType = val;
      refresh();
    });
    awardTypeSelect.className = 'tfe-inline-select';
    awardTypeGroup.appendChild(awardTypeLabel);
    awardTypeGroup.appendChild(awardTypeSelect);

    const awardValGroup = document.createElement('div');
    awardValGroup.className = 'tfe-field-group';
    const awardValLabel = document.createElement('span');
    awardValLabel.className = 'tfe-field-label';
    awardValLabel.textContent = 'Value';
    const awardValInput = document.createElement('input');
    awardValInput.type = 'number';
    awardValInput.className = 'tfe-inline-input tfe-inline-input--number';
    awardValInput.value = String(row.awardValue);
    awardValInput.min = '0';
    awardValInput.max = '99';
    awardValInput.oninput = () => {
      row.awardValue = parseInt(awardValInput.value) || 0;
    };
    awardValInput.onblur = () => refresh();

    awardValGroup.appendChild(awardValLabel);
    awardValGroup.appendChild(awardValInput);

    formatRow.appendChild(formatGroup);
    formatRow.appendChild(awardTypeGroup);
    formatRow.appendChild(awardValGroup);
    card.appendChild(formatRow);

    container.appendChild(card);
  }

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'tfp-empty';
    empty.textContent = 'No collections — click Add Collection to start';
    container.appendChild(empty);
  }
}

function createSelect(
  options: SelectOption[] | string[],
  current: string,
  onChange: (val: string) => void,
): HTMLSelectElement {
  const select = document.createElement('select');
  for (const opt of options) {
    const isObj = typeof opt === 'object';
    const value = isObj ? opt.value : opt;
    const label = isObj ? opt.label : opt;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    if (value === current) option.selected = true;
    select.appendChild(option);
  }
  select.onchange = () => onChange(select.value);
  return select;
}

function capitalize(str: string): string {
  if (!str) return str;
  const lower = str.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

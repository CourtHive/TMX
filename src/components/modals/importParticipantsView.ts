/**
 * Manual column-mapping view for participant imports.
 *
 * Both entry points — drag/drop CSV/TSV (`importPlayersCsv`) and the
 * Google Sheet flow (`sheetsLink`) — funnel into this view after parsing
 * + auto-mapping. The view lets the user inspect/correct the proposed
 * mapping, surfaces dedupe-by-email merges, lets them resolve any rating
 * cells the auto-detector couldn't classify, and then commits via
 * `commitParticipantImport`.
 *
 * Layout (top to bottom inside the modal body):
 *   1. Summary line (row count, merge-by-email count, error count)
 *   2. Mapping table — one row per source column (header + sample + target select)
 *   3. Unresolved ratings panel — only when an Auto-detect rating column has
 *      cells whose scale could not be inferred
 *   4. Live participant preview — first 3 rows after dedupe, parsed with the
 *      current mapping
 *   5. Entry defaults — entryStatus / entryStage selects for the M4 event
 *      assignment flow (UI only in M3; passed through to commitParticipantImport
 *      so M4 can wire it up without further view changes)
 */
import { commitParticipantImport } from 'services/import/commitParticipantImport';
import { autoMapColumns } from 'services/import/autoMapColumns';
import { parseRatingCell } from 'services/import/parseRatingCell';
import { tournamentEngine } from 'tods-competition-factory';
import { dedupeByEmail } from 'services/import/dedupeByEmail';
import { openModal } from './baseModal/baseModal';
import { hashCode } from 'functions/hashCode';
import { t } from 'i18n';

import 'styles/importParticipants.css';

// constants and types
import {
  RATING_SYNONYMS,
  TARGET_FIELD_GROUPS,
  TargetField,
  TargetFieldKind,
} from 'services/import/participantFieldModel';
import type { ColumnMapping } from 'services/import/autoMapColumns';

const PREVIEW_ROW_LIMIT = 3;
const SAMPLE_VALUE_MAX_LEN = 60;

const AUTO_DETECT = '__AUTO__';

const SECTION_HEADING_CLASS = 'ipv-section-heading';

const ENTRY_STATUS_OPTIONS = ['DIRECT_ACCEPTANCE', 'ALTERNATE', 'WILDCARD', 'QUALIFIER', 'LUCKY_LOSER'];
const ENTRY_STAGE_OPTIONS = ['MAIN', 'QUALIFYING', 'PLAYOFFS'];

const SPLIT_DEFAULT_DELIMITER = '/';

export type ImportParticipantsViewArgs = {
  headers: string[];
  rows: string[][];
  additionalMethods?: any[];
  callback?: (result: any) => void;
};

type TournamentEventOption = { eventId: string; eventName: string };

type State = {
  headers: string[];
  rows: string[][];
  mapping: ColumnMapping;
  /** Per-cell rating overrides keyed by `rowIdx:colIdx`. */
  ratingOverrides: Map<string, string>;
  entryStatus: string;
  entryStage: string;
  events: TournamentEventOption[];
};

export function openImportParticipantsView(args: ImportParticipantsViewArgs): void {
  const state: State = {
    headers: args.headers,
    rows: args.rows,
    mapping: autoMapColumns(args.headers),
    ratingOverrides: new Map(),
    entryStatus: 'DIRECT_ACCEPTANCE',
    entryStage: 'MAIN',
    events: loadTournamentEvents(),
  };

  let body: HTMLElement | undefined;

  const refresh = () => {
    if (!body) return;
    body.innerHTML = '';
    body.appendChild(buildSummary(state));
    body.appendChild(buildMappingTable(state, refresh));
    const unresolvedPanel = buildUnresolvedRatingsPanel(state, refresh);
    if (unresolvedPanel) body.appendChild(unresolvedPanel);
    body.appendChild(buildPreview(state));
    body.appendChild(buildEntryDefaults(state, refresh));
  };

  const content = (elem: HTMLElement) => {
    body = elem;
    body.classList.add('import-participants-view');
    refresh();
  };

  const handleReautoDetect = () => {
    state.mapping = autoMapColumns(state.headers);
    state.ratingOverrides.clear();
    refresh();
  };

  const handleImport = () => {
    const finalRows = applyRatingOverrides(state);
    commitParticipantImport({
      headers: state.headers,
      rows: finalRows,
      mapping: state.mapping,
      additionalMethods: args.additionalMethods,
      entryStatus: state.entryStatus,
      entryStage: state.entryStage,
      callback: args.callback,
    });
  };

  openModal({
    title: t('modals.importParticipants.title'),
    config: { padding: '.5', maxWidth: 980 },
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'is-nothing', close: true },
      { label: t('modals.importParticipants.reAutoDetect'), intent: 'is-info', onClick: handleReautoDetect, close: false },
      { label: t('modals.importParticipants.import'), intent: 'is-primary', onClick: handleImport, close: true },
    ],
  });
}

// ─── Summary ──────────────────────────────────────────────────────────

function buildSummary(state: State): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ipv-summary';

  const totalRows = state.rows.length;
  const emailColumnIndex = findColumnByKind(state.mapping, 'email');
  const { mergeCount } = dedupeByEmail(state.rows, emailColumnIndex);
  const importable = totalRows - mergeCount;

  const main = document.createElement('div');
  main.textContent = t('modals.importParticipants.summary', { count: importable });
  wrap.appendChild(main);

  if (mergeCount > 0) {
    const merge = document.createElement('div');
    merge.className = 'ipv-summary-merge';
    merge.textContent = t('modals.importParticipants.mergeNotice', { count: mergeCount });
    wrap.appendChild(merge);
  }

  return wrap;
}

// ─── Mapping table ────────────────────────────────────────────────────

function buildMappingTable(state: State, refresh: () => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ipv-mapping-wrap';

  const table = document.createElement('table');
  table.className = 'ipv-mapping-table';

  const headerOccurrenceIndex = computeHeaderOccurrenceLabels(state.headers);

  table.appendChild(buildMappingTableHead());

  const tbody = document.createElement('tbody');
  for (let i = 0; i < state.headers.length; i++) {
    tbody.appendChild(buildMappingRow(state, i, headerOccurrenceIndex[i], refresh));
  }
  table.appendChild(tbody);

  wrap.appendChild(table);
  return wrap;
}

function buildMappingTableHead(): HTMLElement {
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  for (const key of ['header', 'sample', 'target']) {
    const th = document.createElement('th');
    th.textContent = t(`modals.importParticipants.column.${key}`);
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  return thead;
}

function buildMappingRow(state: State, colIdx: number, headerLabel: string, refresh: () => void): HTMLElement {
  const tr = document.createElement('tr');
  tr.className = 'ipv-mapping-row';

  const headerCell = document.createElement('td');
  headerCell.className = 'ipv-header-cell';
  headerCell.textContent = headerLabel;
  tr.appendChild(headerCell);

  const sampleCell = document.createElement('td');
  sampleCell.className = 'ipv-sample-cell';
  sampleCell.textContent = firstNonEmptySample(state.rows, colIdx);
  tr.appendChild(sampleCell);

  const targetCell = document.createElement('td');
  targetCell.className = 'ipv-target-cell';
  targetCell.appendChild(buildTargetSelect(state, colIdx, refresh));
  const field = state.mapping[colIdx];
  if (field?.kind === 'rating') {
    targetCell.appendChild(buildRatingScaleSelect(state, colIdx, refresh));
  }
  if (field?.kind === 'split') {
    targetCell.appendChild(buildSplitConfigButton(state, colIdx, refresh));
  }
  if (field?.kind === 'eventEntry') {
    targetCell.appendChild(buildEventPickerSelect(state, colIdx, refresh));
  }
  tr.appendChild(targetCell);

  return tr;
}

function buildTargetSelect(state: State, colIdx: number, refresh: () => void): HTMLElement {
  const select = document.createElement('select');
  select.className = 'ipv-target-select';

  const current = state.mapping[colIdx];
  const currentKind: TargetFieldKind = current?.kind ?? 'ignore';

  const noEvents = state.events.length === 0;
  for (const group of TARGET_FIELD_GROUPS) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.label;
    for (const kind of group.fields) {
      const option = document.createElement('option');
      option.value = kind;
      option.textContent = t(`modals.importParticipants.target.${kind}`);
      // Event entry requires at least one tournament event to target.
      if (kind === 'eventEntry' && noEvents) option.disabled = true;
      if (kind === currentKind) option.selected = true;
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }

  select.addEventListener('change', (e) => {
    const newKind = (e.target as HTMLSelectElement).value as TargetFieldKind;
    state.mapping[colIdx] = buildFieldForKind(newKind, state.mapping[colIdx]);
    // Drop any per-cell rating overrides for this column when the kind changes.
    if (newKind !== 'rating') {
      for (const key of [...state.ratingOverrides.keys()]) {
        if (key.endsWith(`:${colIdx}`)) state.ratingOverrides.delete(key);
      }
    }
    refresh();
  });

  return select;
}

function buildRatingScaleSelect(state: State, colIdx: number, refresh: () => void): HTMLElement {
  const select = document.createElement('select');
  select.className = 'ipv-rating-scale-select';

  const current = state.mapping[colIdx]?.ratingScaleName;

  const autoOption = document.createElement('option');
  autoOption.value = AUTO_DETECT;
  autoOption.textContent = t('modals.importParticipants.ratingAuto');
  if (!current) autoOption.selected = true;
  select.appendChild(autoOption);

  for (const { scaleName } of RATING_SYNONYMS) {
    const option = document.createElement('option');
    option.value = scaleName;
    option.textContent = scaleName;
    if (current === scaleName) option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    const scale = value === AUTO_DETECT ? undefined : value;
    state.mapping[colIdx] = { kind: 'rating', ratingScaleName: scale };
    // Switching to an explicit scale clears any per-row overrides for this column.
    if (scale) {
      for (const key of [...state.ratingOverrides.keys()]) {
        if (key.endsWith(`:${colIdx}`)) state.ratingOverrides.delete(key);
      }
    }
    refresh();
  });

  return select;
}

function buildSplitConfigButton(state: State, colIdx: number, refresh: () => void): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'ipv-split-config';

  const field = state.mapping[colIdx];
  const split = field?.split;

  const summary = document.createElement('span');
  summary.className = 'ipv-split-summary';
  if (split) {
    const piecesLabel = split.pieces.map((p) => p.kind).join(', ');
    summary.textContent = `"${split.delimiter}" → ${piecesLabel}`;
  } else {
    summary.textContent = t('modals.importParticipants.splitNotConfigured');
  }
  wrap.appendChild(summary);

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'ipv-split-edit';
  editBtn.textContent = t('modals.importParticipants.splitConfigure');
  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    promptSplitConfig(state, colIdx, refresh);
  });
  wrap.appendChild(editBtn);

  return wrap;
}

function promptSplitConfig(state: State, colIdx: number, refresh: () => void): void {
  const sample = firstNonEmptySample(state.rows, colIdx);
  const existing = state.mapping[colIdx]?.split;

  const delimiter = window.prompt(
    t('modals.importParticipants.splitDelimiterPrompt', { sample }),
    existing?.delimiter ?? SPLIT_DEFAULT_DELIMITER,
  );
  if (delimiter == null || delimiter === '') return;

  const pieces = sample ? sample.split(delimiter) : [''];
  const pieceFields: TargetField[] = [];

  for (let i = 0; i < pieces.length; i++) {
    const piecePreview = pieces[i].trim() || `(piece ${i + 1})`;
    const existingKind = existing?.pieces[i]?.kind;
    const value = window.prompt(
      t('modals.importParticipants.splitPiecePrompt', { piece: piecePreview }),
      existingKind ?? 'ignore',
    );
    if (value == null) return;
    pieceFields.push({ kind: (value || 'ignore') as TargetFieldKind });
  }

  state.mapping[colIdx] = { kind: 'split', split: { delimiter, pieces: pieceFields } };
  refresh();
}

function buildFieldForKind(kind: TargetFieldKind, previous: TargetField | undefined): TargetField {
  if (kind === 'rating') {
    return { kind: 'rating', ratingScaleName: previous?.kind === 'rating' ? previous.ratingScaleName : undefined };
  }
  if (kind === 'split') {
    return { kind: 'split', split: previous?.split ?? { delimiter: SPLIT_DEFAULT_DELIMITER, pieces: [] } };
  }
  if (kind === 'eventEntry') {
    return { kind: 'eventEntry', eventId: previous?.kind === 'eventEntry' ? previous.eventId : undefined };
  }
  return { kind };
}

function buildEventPickerSelect(state: State, colIdx: number, refresh: () => void): HTMLElement {
  const select = document.createElement('select');
  select.className = 'ipv-event-picker-select';

  const current = state.mapping[colIdx]?.eventId;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('modals.importParticipants.eventPickerPlaceholder');
  if (!current) placeholder.selected = true;
  select.appendChild(placeholder);

  for (const event of state.events) {
    const option = document.createElement('option');
    option.value = event.eventId;
    option.textContent = event.eventName;
    if (event.eventId === current) option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    state.mapping[colIdx] = { kind: 'eventEntry', eventId: value || undefined };
    refresh();
  });

  return select;
}

function loadTournamentEvents(): TournamentEventOption[] {
  const events = tournamentEngine.getEvents()?.events ?? [];
  return events.map((event: any) => ({
    eventId: event.eventId,
    eventName: event.eventName ?? event.eventId,
  }));
}

// ─── Unresolved ratings panel ─────────────────────────────────────────

type UnresolvedRating = { rowIdx: number; colIdx: number; raw: string };

function findUnresolvedRatings(state: State): UnresolvedRating[] {
  const list: UnresolvedRating[] = [];
  for (const [colKey, field] of Object.entries(state.mapping)) {
    if (field?.kind !== 'rating' || field.ratingScaleName) continue;
    const colIdx = Number(colKey);
    for (let r = 0; r < state.rows.length; r++) {
      const cell = state.rows[r]?.[colIdx];
      if (cell == null || String(cell).trim() === '') continue;
      const raw = String(cell).trim();
      if (parseRatingCell(raw)) continue;
      if (state.ratingOverrides.has(`${r}:${colIdx}`)) continue;
      list.push({ rowIdx: r, colIdx, raw });
    }
  }
  return list;
}

function buildUnresolvedRatingsPanel(state: State, refresh: () => void): HTMLElement | null {
  const unresolved = findUnresolvedRatings(state);
  if (!unresolved.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'ipv-unresolved-wrap';

  const heading = document.createElement('h4');
  heading.className = SECTION_HEADING_CLASS;
  heading.textContent = t('modals.importParticipants.unresolvedHeading', { count: unresolved.length });
  wrap.appendChild(heading);

  const table = document.createElement('table');
  table.className = 'ipv-unresolved-table';
  for (const item of unresolved) {
    table.appendChild(buildUnresolvedRow(state, item, refresh));
  }
  wrap.appendChild(table);
  return wrap;
}

function buildUnresolvedRow(state: State, item: UnresolvedRating, refresh: () => void): HTMLElement {
  const tr = document.createElement('tr');

  const rowLabel = document.createElement('td');
  rowLabel.className = 'ipv-unresolved-row-label';
  rowLabel.textContent = `${t('modals.importParticipants.row')} ${item.rowIdx + 1}`;
  tr.appendChild(rowLabel);

  const colLabel = document.createElement('td');
  colLabel.className = 'ipv-unresolved-col-label';
  colLabel.textContent = state.headers[item.colIdx] ?? '';
  tr.appendChild(colLabel);

  const valueLabel = document.createElement('td');
  valueLabel.className = 'ipv-unresolved-value';
  valueLabel.textContent = item.raw;
  tr.appendChild(valueLabel);

  const pickerCell = document.createElement('td');
  const select = document.createElement('select');
  select.className = 'ipv-unresolved-select';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('modals.importParticipants.unresolvedPickerPlaceholder');
  select.appendChild(placeholder);

  for (const { scaleName } of RATING_SYNONYMS) {
    const option = document.createElement('option');
    option.value = scaleName;
    option.textContent = scaleName;
    select.appendChild(option);
  }

  select.addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    if (!value) return;
    state.ratingOverrides.set(`${item.rowIdx}:${item.colIdx}`, value);
    refresh();
  });

  pickerCell.appendChild(select);
  tr.appendChild(pickerCell);
  return tr;
}

// ─── Preview ──────────────────────────────────────────────────────────

function buildPreview(state: State): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ipv-preview-wrap';

  const heading = document.createElement('h4');
  heading.className = SECTION_HEADING_CLASS;
  heading.textContent = t('modals.importParticipants.previewHeading');
  wrap.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'ipv-preview-list';

  const previewParticipants = buildPreviewParticipants(state);
  if (!previewParticipants.length) {
    const empty = document.createElement('div');
    empty.className = 'ipv-preview-empty';
    empty.textContent = t('modals.importParticipants.previewEmpty');
    list.appendChild(empty);
  } else {
    for (const p of previewParticipants) {
      list.appendChild(buildPreviewItem(p));
    }
  }

  wrap.appendChild(list);
  return wrap;
}

function buildPreviewItem(participant: any): HTMLElement {
  const item = document.createElement('div');
  item.className = 'ipv-preview-item';

  const name = document.createElement('div');
  name.className = 'ipv-preview-name';
  name.textContent = participant.participantName ?? '(no name)';
  item.appendChild(name);

  const facts = document.createElement('div');
  facts.className = 'ipv-preview-facts';
  facts.textContent = summarizeParticipant(participant);
  item.appendChild(facts);

  return item;
}

function summarizeParticipant(participant: any): string {
  const bits: string[] = [];
  const person = participant.person ?? {};
  if (person.sex) bits.push(`sex: ${person.sex}`);
  if (person.birthDate) bits.push(`born: ${person.birthDate}`);
  if (person.nationalityCode) bits.push(`country: ${person.nationalityCode}`);
  const address = person.addresses?.[0];
  if (address) {
    const where = [address.city, address.state].filter(Boolean).join(', ');
    if (where) bits.push(where);
  }
  const contact = person.contacts?.[0];
  if (contact?.emailAddress) bits.push(contact.emailAddress);
  if (participant.timeItems?.length) {
    bits.push(participant.timeItems.map((ti: any) => ti.itemType.split('.').at(-1)).join(', '));
  }
  return bits.join(' · ');
}

function buildPreviewParticipants(state: State): any[] {
  const finalRows = applyRatingOverrides(state);
  const emailColumnIndex = findColumnByKind(state.mapping, 'email');
  const { mergedRows } = dedupeByEmail(finalRows, emailColumnIndex);
  const participants: any[] = [];
  for (let r = 0; r < mergedRows.length && participants.length < PREVIEW_ROW_LIMIT; r++) {
    const built = previewBuildParticipant(state, mergedRows[r]);
    if (built) participants.push(built);
  }
  return participants;
}

type CollectedPreviewRow = {
  collected: Partial<Record<TargetFieldKind, string>>;
  ratings: Array<{ scaleName: string; value: number }>;
};

// A trimmed-down preview-only build that mirrors the committer's output enough
// to give the user a feel for what will be created. Kept local because the
// committer's full path involves tournamentEngine + mutationRequest side effects
// that we don't want to run for a preview.
function previewBuildParticipant(state: State, row: string[]): any | undefined {
  const { collected, ratings } = collectPreviewRow(state.mapping, row);

  const participantName = derivePreviewName(collected);
  if (!participantName) return undefined;

  const participant: any = {
    participantName,
    person: buildPreviewPerson(collected),
    participantId: `XXX-${hashCode(participantName)}`,
  };
  if (ratings.length) {
    participant.timeItems = ratings.map(({ scaleName, value }) => ({
      itemType: `SCALE.RATING.SINGLES.${scaleName}`,
      itemValue: { [`${scaleName.toLowerCase()}Rating`]: value },
    }));
  }
  return participant;
}

function collectPreviewRow(mapping: ColumnMapping, row: string[]): CollectedPreviewRow {
  const collected: Partial<Record<TargetFieldKind, string>> = {};
  const ratings: Array<{ scaleName: string; value: number }> = [];

  for (const [key, field] of Object.entries(mapping)) {
    if (!field || field.kind === 'ignore' || field.kind === 'eventEntry') continue;
    const cell = row[Number(key)];
    if (cell == null) continue;
    const raw = String(cell).trim();
    if (!raw) continue;

    if (field.kind === 'rating') {
      const parsed = parseRatingCell(raw, { defaultScaleName: field.ratingScaleName });
      if (parsed) ratings.push(parsed);
      continue;
    }
    if (field.kind === 'split') {
      applyPreviewSplit(collected, field, raw);
      continue;
    }
    collected[field.kind] = raw;
  }
  return { collected, ratings };
}

function applyPreviewSplit(
  collected: Partial<Record<TargetFieldKind, string>>,
  field: TargetField,
  raw: string,
): void {
  if (!field.split) return;
  const pieces = raw.split(field.split.delimiter);
  field.split.pieces.forEach((pieceField, i) => {
    if (!pieceField || pieceField.kind === 'ignore' || pieceField.kind === 'split') return;
    const value = (pieces[i] ?? '').trim();
    if (value) collected[pieceField.kind] = value;
  });
}

function derivePreviewName(collected: Partial<Record<TargetFieldKind, string>>): string | undefined {
  const { firstName, lastName, fullName, otherName } = collected;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  return fullName || otherName || undefined;
}

function buildPreviewPerson(collected: Partial<Record<TargetFieldKind, string>>): any {
  const person: any = {};
  if (collected.firstName) person.standardGivenName = collected.firstName;
  if (collected.lastName) person.standardFamilyName = collected.lastName;
  if (collected.sex) person.sex = collected.sex.toUpperCase();
  if (collected.birthDate) person.birthDate = collected.birthDate;
  if (collected.nationalityCode) person.nationalityCode = collected.nationalityCode.toUpperCase();
  if (collected.city || collected.state) {
    person.addresses = [{ city: collected.city, state: collected.state }];
  }
  if (collected.email || collected.phone) {
    person.contacts = [
      {
        ...(collected.email && { emailAddress: collected.email }),
        ...(collected.phone && { telephone: collected.phone }),
      },
    ];
  }
  return person;
}

// ─── Entry defaults footer ────────────────────────────────────────────

function buildEntryDefaults(state: State, refresh: () => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ipv-entry-defaults';

  const heading = document.createElement('h4');
  heading.className = SECTION_HEADING_CLASS;
  heading.textContent = t('modals.importParticipants.entryDefaultsHeading');
  wrap.appendChild(heading);

  const row = document.createElement('div');
  row.className = 'ipv-entry-defaults-row';

  row.appendChild(buildEntryDefaultSelect('entryStatus', state.entryStatus, ENTRY_STATUS_OPTIONS, (value) => {
    state.entryStatus = value;
    refresh();
  }));
  row.appendChild(buildEntryDefaultSelect('entryStage', state.entryStage, ENTRY_STAGE_OPTIONS, (value) => {
    state.entryStage = value;
    refresh();
  }));

  wrap.appendChild(row);
  return wrap;
}

function buildEntryDefaultSelect(
  fieldKey: 'entryStatus' | 'entryStage',
  value: string,
  options: string[],
  onChange: (value: string) => void,
): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'ipv-entry-default-field';

  const labelText = document.createElement('span');
  labelText.textContent = t(`modals.importParticipants.${fieldKey}Label`);
  wrap.appendChild(labelText);

  const select = document.createElement('select');
  for (const option of options) {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = option;
    if (option === value) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', (e) => onChange((e.target as HTMLSelectElement).value));
  wrap.appendChild(select);

  return wrap;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function findColumnByKind(mapping: ColumnMapping, kind: TargetFieldKind): number | undefined {
  for (const [key, field] of Object.entries(mapping)) {
    if (field?.kind === kind) return Number(key);
  }
  return undefined;
}

function firstNonEmptySample(rows: string[][], colIdx: number): string {
  for (const row of rows) {
    const cell = row?.[colIdx];
    if (cell == null) continue;
    const value = String(cell).trim();
    if (value) {
      return value.length > SAMPLE_VALUE_MAX_LEN ? `${value.slice(0, SAMPLE_VALUE_MAX_LEN)}…` : value;
    }
  }
  return '';
}

function computeHeaderOccurrenceLabels(headers: string[]): string[] {
  const counts = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const header of headers) {
    totals.set(header, (totals.get(header) ?? 0) + 1);
  }
  return headers.map((header) => {
    const total = totals.get(header) ?? 1;
    if (total <= 1) return header;
    const seen = (counts.get(header) ?? 0) + 1;
    counts.set(header, seen);
    return `${header} (#${seen})`;
  });
}

/**
 * Apply per-row rating overrides by prefixing the cell text with the chosen
 * scale name so the committer's parseRatingCell picks it up unmodified.
 */
function applyRatingOverrides(state: State): string[][] {
  if (!state.ratingOverrides.size) return state.rows;
  const cloned = state.rows.map((row) => [...row]);
  for (const [key, scaleName] of state.ratingOverrides.entries()) {
    const [rowIdxStr, colIdxStr] = key.split(':');
    const r = Number(rowIdxStr);
    const c = Number(colIdxStr);
    const cell = cloned[r]?.[c];
    if (cell == null) continue;
    cloned[r][c] = `${scaleName} ${String(cell).trim()}`;
  }
  return cloned;
}


/**
 * DOM for the provider schedule page — a chronological list of the fixtures a subject took part in.
 *
 * Deliberately NOT the tournaments-page card grid or its Tabulator table. Those answer "what does
 * this provider own, and what state is each tournament in", and carry the chips, sort and view
 * toggle that question needs. A season answers "when does this programme play, and against whom",
 * reads top to bottom in date order, and has no status axis worth filtering on — a shared component
 * would have to serve both and would serve neither.
 */
import { formatFixtureDates, ParticipationEntry, ParticipationYearGroup } from './participationEntries';
import { t } from 'i18n';

import { PARTICIPATION_LIST } from 'constants/tmxConstants';

import './providerSchedule.css';

const LIST_CLASS = 'tmx-schedule-list';
const ROW_CLASS = 'tmx-schedule-row';
const YEAR_CLASS = 'tmx-schedule-year';
const NOTICE_CLASS = 'tmx-schedule-notice';
const SKELETON_ROW_CLASS = 'tmx-schedule-row--skeleton';
const SKELETON_ROW_COUNT = 6;

export interface ScheduleHeaderParams {
  /** The subject's display name where one is known, else its id — see the page for why an id is
   *  the honest fallback rather than a placeholder. */
  subjectLabel: string;
  fixtureCount?: number;
}

export function buildScheduleHeader({ subjectLabel, fixtureCount }: ScheduleHeaderParams): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'tabHeader tabHeader--banner tmx-schedule-header';

  const title = document.createElement('span');
  title.className = 'tmx-schedule-header__title';
  title.textContent = t('pages.participation.title');
  banner.appendChild(title);

  const subject = document.createElement('span');
  subject.className = 'tmx-schedule-header__subject';
  subject.textContent = subjectLabel;
  banner.appendChild(subject);

  const count = document.createElement('span');
  count.className = 'tmx-schedule-header__count';
  count.dataset.fixtureCount = fixtureCount === undefined ? '' : String(fixtureCount);
  // Undefined while loading or after a failure: a count is a claim about the data, and there is no
  // data to make it about yet.
  count.textContent = fixtureCount === undefined ? '' : t('pages.participation.fixtureCount', { count: fixtureCount });
  banner.appendChild(count);

  return banner;
}

function buildListHost(): HTMLElement {
  const list = document.createElement('div');
  list.className = LIST_CLASS;
  list.id = PARTICIPATION_LIST;
  return list;
}

function buildNotice(message: string, variant: 'empty' | 'error'): HTMLElement {
  const notice = document.createElement('div');
  notice.className = `${NOTICE_CLASS} ${NOTICE_CLASS}--${variant}`;
  notice.dataset.noticeVariant = variant;
  notice.textContent = message;
  return notice;
}

export function renderScheduleSkeleton(anchor: HTMLElement): void {
  const list = buildListHost();
  for (let i = 0; i < SKELETON_ROW_COUNT; i++) {
    const row = document.createElement('div');
    row.className = `${ROW_CLASS} ${SKELETON_ROW_CLASS}`;
    list.appendChild(row);
  }
  anchor.replaceChildren(list);
}

/**
 * No fixtures is an ORDINARY ANSWER, not a failure — dozens of seeded team providers have no
 * fixtures in the corpus. The wording says what is true of the data ("no fixtures recorded"), never
 * anything that reads as a load that went wrong.
 */
export function renderScheduleEmpty(anchor: HTMLElement): void {
  const list = buildListHost();
  list.appendChild(buildNotice(t('pages.participation.noFixtures'), 'empty'));
  anchor.replaceChildren(list);
}

/** A fault, and it has to look like one — with a way to try again. */
export function renderScheduleError(anchor: HTMLElement, onRetry: () => void): void {
  const list = buildListHost();
  const notice = buildNotice(t('pages.participation.loadFailed'), 'error');

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'button is-small is-info is-outlined tmx-schedule-retry';
  retry.textContent = t('pages.participation.retry');
  retry.onclick = onRetry;
  notice.appendChild(retry);

  list.appendChild(notice);
  anchor.replaceChildren(list);
}

function buildRow(entry: ParticipationEntry, onOpen: (tournamentId: string) => void): HTMLElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = ROW_CLASS;
  row.dataset.tournamentId = entry.tournamentId;
  // The raw ISO day rides along beside the localized text so anything asserting on a date reads the
  // value rather than whatever the runtime locale rendered.
  row.dataset.startDate = entry.startDate ?? '';

  const dates = document.createElement('span');
  dates.className = 'tmx-schedule-row__dates';
  dates.textContent = formatFixtureDates(entry.startDate, entry.endDate) || t('pages.participation.undated');
  row.appendChild(dates);

  const name = document.createElement('span');
  name.className = 'tmx-schedule-row__name';
  name.textContent = entry.tournamentName ?? entry.tournamentId;
  row.appendChild(name);

  const events = document.createElement('span');
  events.className = 'tmx-schedule-row__events';
  events.textContent =
    entry.eventCount === undefined ? '' : t('pages.participation.eventCount', { count: entry.eventCount });
  row.appendChild(events);

  row.onclick = () => onOpen(entry.tournamentId);
  return row;
}

export function renderScheduleGroups(
  anchor: HTMLElement,
  groups: ParticipationYearGroup[],
  onOpen: (tournamentId: string) => void,
): void {
  const list = buildListHost();

  for (const group of groups) {
    const heading = document.createElement('div');
    heading.className = YEAR_CLASS;
    heading.textContent = group.year || t('pages.participation.undated');
    list.appendChild(heading);
    for (const entry of group.entries) list.appendChild(buildRow(entry, onOpen));
  }

  anchor.replaceChildren(list);
}

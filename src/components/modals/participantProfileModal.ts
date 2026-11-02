/**
 * Participant Profile Modal — shows participant info, event entries,
 * ratings/rankings, the pairs / teams / groups an individual belongs to
 * (or a pair's players), and ranking point breakdown with policy + level selectors.
 */
import { getAvailablePolicies, getLevelDisplayLabel } from 'components/tables/pointsTable/policyUtils';
import { headerSortElement } from 'components/tables/common/sorters/headerSortElement';
import { fixtures, factoryConstants, unwrapOr } from 'tods-competition-factory';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { buildParticipantFingerprint } from './participantFingerprint';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { tournamentEngine } from 'services/factory/engine';
import { controlBar, cModal } from 'courthive-components';

// constants
import { entryStatusMapping, LEFT, RIGHT } from 'constants/tmxConstants';
import { escapeHtml } from 'utilities/escapeHtml';
import { t } from 'i18n';
import {
  affiliationIsMembership,
  getGroupingMembers,
  getParticipantGroupings,
  type GroupingEvent,
  type GroupingMember,
  type ParticipantGroupings,
} from './participantGroupings';

const { ratingsParameters } = fixtures;
const { SINGLES } = factoryConstants.eventConstants;
const { PAIR } = factoryConstants.participantConstants;

function getPointsColumns(onEventClick: (eventId: string) => void): any[] {
  return [
    {
      title: t('tables.events.event'),
      field: 'eventName',
      minWidth: 160,
      headerSort: true,
      responsive: 0,
      formatter: (cell: any) => {
        const val = cell.getValue();
        const rowData = cell.getRow().getData();
        if (rowData.eventId) {
          const link = document.createElement('span');
          link.textContent = val || '';
          link.style.cssText = 'cursor: pointer; text-decoration: underline; color: var(--tmx-accent-blue, #3273dc);';
          link.onclick = (e) => {
            e.stopPropagation();
            onEventClick(rowData.eventId);
          };
          return link;
        }
        return val || '';
      },
    },
    {
      title: t('tournaments.done'),
      field: 'rangeAccessor',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 2,
    },
    {
      title: t('modals.participantProfile.wins'),
      field: 'winCount',
      hozAlign: 'center',
      headerSort: true,
      width: 70,
      responsive: 2,
    },
    {
      title: t('tables.selection.position'),
      field: 'positionPoints',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 1,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: t('modals.participantProfile.perWin'),
      field: 'perWinPoints',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 2,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: t('modals.participantProfile.bonus'),
      field: 'bonusPoints',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 2,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: t('modals.participantProfile.quality'),
      field: 'qualityWinPoints',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 3,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: t('tot'),
      field: 'points',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 0,
      formatter: (cell: any) => {
        const val = cell.getValue();
        return val ? `<strong>${escapeHtml(val)}</strong>` : '';
      },
    },
  ];
}

// --- Info section builders ---

function buildInfoHeader(participant: any): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; gap: 1em; margin-bottom: 1em; flex-wrap: wrap;';

  const person = participant.person || {};

  // Flag + name
  const nameBlock = document.createElement('div');
  nameBlock.style.cssText = 'display: flex; align-items: center; gap: 0.5em;';

  const nationalityCode = person.iso2NationalityCode || '';
  if (nationalityCode) {
    const flag = fixtures.countryToFlag(nationalityCode)?.slice(0, 4) || '';
    if (flag) {
      const flagEl = document.createElement('span');
      flagEl.style.fontSize = '1.5em';
      flagEl.textContent = flag;
      nameBlock.appendChild(flagEl);
    }
  }

  const nameEl = document.createElement('span');
  nameEl.style.cssText = 'font-size: 1.1em; font-weight: 600;';
  nameEl.textContent = participant.participantName || '';
  nameBlock.appendChild(nameEl);

  if (participant.participantOtherName) {
    const nicknameEl = document.createElement('span');
    nicknameEl.style.cssText = 'font-size: 0.95em; font-style: italic; color: var(--tmx-text-secondary, #666);';
    nicknameEl.textContent = `"${participant.participantOtherName}"`;
    nameBlock.appendChild(nicknameEl);
  }

  header.appendChild(nameBlock);

  // Country name
  const countryName = person.countryName;
  if (countryName) {
    const countryEl = document.createElement('span');
    countryEl.style.cssText = 'color: var(--tmx-text-secondary, #666); font-size: 0.9em;';
    countryEl.textContent = countryName;
    header.appendChild(countryEl);
  }

  // City/State
  const address = person.addresses?.[0];
  const cityState = address?.city && address?.state ? `${address.city}, ${address.state}` : address?.city || '';
  if (cityState) {
    const locationEl = document.createElement('span');
    locationEl.style.cssText = 'color: var(--tmx-text-secondary, #666); font-size: 0.9em;';
    locationEl.innerHTML = '<i class="fas fa-map-marker-alt" style="margin-right: 0.3em;"></i>';
    locationEl.append(cityState);
    header.appendChild(locationEl);
  }

  return header;
}

function buildRatingsSection(participant: any): HTMLElement | undefined {
  const ratings = participant.ratings?.[SINGLES] || [];
  const rankings = participant.rankings?.[SINGLES] || [];
  if (!ratings.length && !rankings.length) return undefined;

  const section = document.createElement('div');
  section.style.cssText = 'display: flex; gap: 0.75em; flex-wrap: wrap; margin-bottom: 1em;';

  for (const item of rankings) {
    const chip = createChip(`#${item.scaleValue}`, item.scaleName, 'var(--tmx-accent-blue, #3273dc)');
    section.appendChild(chip);
  }

  for (const item of ratings) {
    const params = ratingsParameters[item.scaleName.toUpperCase()];
    const accessor = params?.accessor || `${item.scaleName.toLowerCase()}Rating`;
    let displayValue = item.scaleValue;
    if (typeof displayValue === 'object' && displayValue !== null) {
      displayValue = displayValue[accessor] ?? Object.values(displayValue)[0];
    }
    if (displayValue == null) continue;
    const chip = createChip(String(displayValue), item.scaleName.toUpperCase(), 'var(--tmx-accent-green, #48c774)');
    section.appendChild(chip);
  }

  return section;
}

/**
 * Renders team-affiliation + jersey-number chips below the ratings row.
 * Both pieces live on `person.biographicalInformation.teamAttributes[0]`
 * (the import wizard writes them there). Section is omitted entirely
 * when neither field has a value so individual participants who aren't
 * team-affiliated see no change.
 *
 * Affiliation is a free-text attribute on the person, not TEAM membership —
 * membership is the Teams section, read from the TEAM participants that hold
 * this individual. The chip is labelled "Affiliation" so the two never read as
 * one claim, and the affiliation name is dropped when it names a team the
 * Teams section already lists.
 */
function buildTeamAffiliationSection(
  participant: any,
  memberTeams: ParticipantGroupings['teams'],
): HTMLElement | undefined {
  const teamAttribute = participant.person?.biographicalInformation?.teamAttributes?.[0];
  const teamName = affiliationIsMembership(teamAttribute?.teamName, memberTeams) ? undefined : teamAttribute?.teamName;
  const jerseyNumber = teamAttribute?.jerseyNumber;
  if (!teamName && (jerseyNumber == null || jerseyNumber === '')) return undefined;

  const section = document.createElement('div');
  section.style.cssText = 'display: flex; gap: 0.75em; flex-wrap: wrap; margin-bottom: 1em;';

  // Team affiliation accent: orange. Sits distinct from ratings (green),
  // rankings (blue), and events (purple) so the four chip families are
  // glance-distinguishable.
  const teamAccent = 'var(--tmx-accent-orange, #ff9f00)';

  if (teamName) {
    section.appendChild(
      createChip(teamName, t('modals.participantProfile.affiliation').toLocaleUpperCase(), teamAccent),
    );
  }
  if (jerseyNumber != null && jerseyNumber !== '') {
    section.appendChild(
      createChip(`#${jerseyNumber}`, t('modals.participantProfile.jersey').toLocaleUpperCase(), teamAccent),
    );
  }

  return section;
}

function buildEventChips(participant: any, allEvents: any[]): HTMLElement | undefined {
  const participantEvents = participant.events || [];
  if (!participantEvents.length) return undefined;

  const eventMap: Record<string, any> = {};
  for (const e of allEvents) eventMap[e.eventId] = e;

  const section = document.createElement('div');
  section.style.cssText = 'display: flex; gap: 0.5em; flex-wrap: wrap; margin-bottom: 1em;';

  for (const entry of participantEvents) {
    const evt = eventMap[entry.eventId];
    const eventName = evt?.eventName || entry.eventId;
    const statusAbbrev = (entryStatusMapping as any)[entry.entryStatus] || entry.entryStatus || '';
    const label = statusAbbrev ? `${eventName} (${statusAbbrev})` : eventName;
    const chip = createChip(label, undefined, 'var(--tmx-accent-purple, #b86bff)');
    section.appendChild(chip);
  }

  return section;
}

function createChip(text: string, subtitle?: string, color?: string): HTMLElement {
  // Accents are theme vars (`var(--tmx-accent-*)`), so the tint is mixed rather than built by
  // appending a hex alpha, which is invalid CSS on a var() and left every chip untinted.
  const tint = color || 'var(--tmx-text-secondary, #666)';
  const chip = document.createElement('span');
  chip.style.cssText = `
    display: inline-flex; align-items: center; gap: 0.3em;
    padding: 0.25em 0.6em; border-radius: 4px; font-size: 0.85em;
    background: color-mix(in srgb, ${tint} 13%, transparent);
    border: 1px solid color-mix(in srgb, ${tint} 27%, transparent);
    color: var(--tmx-text-primary, #333);
  `;
  if (subtitle) {
    const sub = document.createElement('span');
    sub.style.cssText = 'font-weight: 600; opacity: 0.7; font-size: 0.85em;';
    sub.textContent = subtitle;
    chip.appendChild(sub);
  }
  const val = document.createElement('span');
  val.style.fontWeight = '500';
  val.textContent = text;
  chip.appendChild(val);
  return chip;
}

// --- Pairs / teams / groups ---

function buildSectionLabel(text: string): HTMLElement {
  const label = document.createElement('div');
  label.style.cssText = 'font-weight: 600; margin-bottom: 0.4em; font-size: 0.95em;';
  label.textContent = text;
  return label;
}

function eventChip(event: GroupingEvent): HTMLElement {
  const statusAbbrev = (entryStatusMapping as any)[event.entryStatus ?? ''] || event.entryStatus || '';
  const label = statusAbbrev ? `${event.eventName} (${statusAbbrev})` : event.eventName;
  return createChip(label, undefined, 'var(--tmx-accent-purple, #b86bff)');
}

type GroupingRow = {
  events?: GroupingEvent[];
  entered?: boolean;
  onOpen: () => void;
  accent: string;
  title: string;
  name: string;
};

/** One clickable row: the grouping's name, then its events, or "Not entered" when it has none. */
function buildGroupingRow({ name, title, accent, events, entered, onOpen }: GroupingRow): HTMLElement {
  const row = document.createElement('div');
  row.setAttribute('role', 'button');
  row.tabIndex = 0;
  row.title = title;
  row.setAttribute('aria-label', t('modals.participantProfile.openProfile', { name: title }));
  row.style.cssText = `
    display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; cursor: pointer;
    padding: 0.35em 0.5em; border-radius: 4px;
    border: 1px solid var(--tmx-border-secondary, #ccc); border-left: 3px solid ${accent};
    background: var(--tmx-bg-secondary, transparent); color: var(--tmx-text-primary, #333);
  `;

  const nameEl = document.createElement('span');
  nameEl.style.cssText = 'font-weight: 600; font-size: 0.9em;';
  nameEl.textContent = name;
  row.appendChild(nameEl);

  for (const event of events ?? []) row.appendChild(eventChip(event));
  if (events && !entered && !events.length) {
    const notEntered = document.createElement('span');
    notEntered.style.cssText = 'font-size: 0.85em; font-style: italic; color: var(--tmx-text-muted, #999);';
    notEntered.textContent = t('modals.participantProfile.notEntered');
    row.appendChild(notEntered);
  }

  row.addEventListener('click', onOpen);
  row.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  });
  return row;
}

function buildGroupingSection(label: string, rows: HTMLElement[]): HTMLElement | undefined {
  if (!rows.length) return undefined;
  const section = document.createElement('div');
  section.style.cssText = 'margin-bottom: 1em;';
  section.appendChild(buildSectionLabel(label));
  const list = document.createElement('div');
  list.style.cssText = 'display: flex; flex-direction: column; gap: 0.35em;';
  for (const row of rows) list.appendChild(row);
  section.appendChild(list);
  return section;
}

type OpenHandlers = {
  openParticipant: (participantId: string) => void;
  openTeam: (participantId: string) => void;
  openGroup: (participantId: string) => void;
};

/** The Pairs, Teams and Groups sections of an individual's card; each omitted when empty. */
function buildMembershipSections(groupings: ParticipantGroupings, open: OpenHandlers): HTMLElement[] {
  const pairAccent = 'var(--tmx-accent-teal, #1f6d66)';
  const teamAccent = 'var(--tmx-accent-orange, #ff9f00)';
  const groupAccent = 'var(--tmx-accent-pink, #a3134f)';

  const pairRows = groupings.pairs.map((pair) => {
    const partner = pair.partners.map(({ participantName }) => participantName).join(', ');
    return buildGroupingRow({
      name: partner ? t('modals.participantProfile.withPartner', { partner }) : pair.participantName,
      onOpen: () => open.openParticipant(pair.participantId),
      title: pair.participantName,
      entered: pair.entered,
      events: pair.events,
      accent: pairAccent,
    });
  });
  const groupingRows = (memberships: ParticipantGroupings['teams'], accent: string, onOpen: (id: string) => void) =>
    memberships.map((membership) =>
      buildGroupingRow({
        onOpen: () => onOpen(membership.participantId),
        title: membership.participantName,
        name: membership.participantName,
        entered: membership.entered,
        events: membership.events,
        accent,
      }),
    );

  return [
    buildGroupingSection(t('modals.participantProfile.pairs'), pairRows),
    buildGroupingSection(
      t('modals.participantProfile.teams'),
      groupingRows(groupings.teams, teamAccent, open.openTeam),
    ),
    buildGroupingSection(
      t('modals.participantProfile.groups'),
      groupingRows(groupings.groups, groupAccent, open.openGroup),
    ),
  ].filter((section): section is HTMLElement => !!section);
}

/** A pair's card lists its players, each opening that player's card. */
function buildPlayersSection(members: GroupingMember[], openParticipant: (id: string) => void) {
  const rows = members.map((member) =>
    buildGroupingRow({
      onOpen: () => openParticipant(member.participantId),
      accent: 'var(--tmx-accent-blue, #3273dc)',
      title: member.participantName,
      name: member.participantName,
    }),
  );
  return buildGroupingSection(t('modals.participantProfile.players'), rows);
}

// --- Main export ---

type ParticipantProfileParams = {
  participantId: string;
  participantIds?: string[];
  readOnly?: boolean;
};

export function participantProfileModal({ participantId, participantIds, readOnly }: ParticipantProfileParams): void {
  const result = tournamentEngine.getParticipants({
    participantFilters: { participantIds: [participantId] },
    withRankingProfile: true,
    withMatchUps: true,
    withScaleValues: true,
    withEvents: true,
    withISO2: true,
  });
  const participant = result?.participants?.[0];
  if (!participant) return;

  const personId = participant.person?.personId;
  const participantEventIds = (participant.events ?? []).map((e: any) => e.eventId);
  const allEvents = tournamentEngine.q.events() || [];

  const availablePolicies = getAvailablePolicies();
  let selectedPolicyId = availablePolicies[0]?.id;
  let selectedLevel: number | undefined;
  let table: any;
  let lastData: any[] = [];

  const getSelectedPolicy = () => availablePolicies.find((p) => p.id === selectedPolicyId);

  // Pairs / teams / groups come from the participantMap the same query returned: it holds every
  // participant, with the factory's groupings on each individual and event entries on each grouping.
  const groupingArgs = { participantId, participantMap: result.participantMap, events: allEvents };
  const groupings = getParticipantGroupings(groupingArgs);
  const pairMembers = participant.participantType === PAIR ? getGroupingMembers(groupingArgs) : [];

  // Same close-then-open the prev/next navigation uses: one card at a time.
  const switchTo = (open: () => unknown) => {
    table?.destroy();
    cModal.close();
    open();
  };
  const openHandlers: OpenHandlers = {
    openParticipant: (id) => switchTo(() => participantProfileModal({ participantId: id, readOnly })),
    // Loaded on demand: the group profile edits membership, so a static import would pull the
    // mutation stack into every module that opens a participant card.
    openTeam: (id) =>
      switchTo(() =>
        import('./teamProfileModal').then(({ teamProfileModal }) => teamProfileModal({ participantId: id })),
      ),
    openGroup: (id) =>
      switchTo(() =>
        import('./groupProfileModal').then(({ groupProfileModal }) => groupProfileModal({ participantId: id })),
      ),
  };

  const computeData = () => {
    const policy = getSelectedPolicy();
    if (!policy) return [];
    if (policy.requiresLevel && !selectedLevel) return [];

    const rows: any[] = [];
    for (const eventId of participantEventIds) {
      // Per-event ranking lookup; participants not in the event surface a
      // typed error — silently skip via unwrapOr(..., null) so the loop
      // continues to the next event.
      const res = unwrapOr(
        tournamentEngine.getEventRankingPoints({
          policyDefinitions: policy.policyData,
          level: selectedLevel,
          eventId,
        }),
        null,
      );
      if (!res?.success) continue;

      const eventName = res.eventName;
      const awards = (res.eventAwards || []).filter(
        (a: any) => a.participantId === participantId || a.personId === personId,
      );

      if (awards.length) {
        for (const award of awards) rows.push({ ...award, eventName, eventId });
      } else {
        const evt = allEvents.find((e: any) => e.eventId === eventId);
        rows.push({ eventName: evt?.eventName || eventName || eventId, eventId, points: 0 });
      }
    }
    return rows;
  };

  // Build content
  const content = document.createElement('div');
  content.style.width = '100%';

  // Participant info header (flag, name, location)
  content.appendChild(buildInfoHeader(participant));

  // Ratings & rankings chips
  const ratingsSection = buildRatingsSection(participant);
  if (ratingsSection) content.appendChild(ratingsSection);

  // Competitive fingerprint — sits under the ratings it is computed from.
  // Returns undefined when there is nothing honest to show.
  const fingerprint = buildParticipantFingerprint({ participantId, participant, matchUps: result.matchUps ?? [] });
  if (fingerprint) content.appendChild(fingerprint);

  // Team affiliation + jersey number chips (only for individuals carrying
  // a teamAttributes[0] entry — set by the import wizard).
  const teamAffiliationSection = buildTeamAffiliationSection(participant, groupings.teams);
  if (teamAffiliationSection) content.appendChild(teamAffiliationSection);

  // Event entry chips
  const eventChips = buildEventChips(participant, allEvents);
  if (eventChips) content.appendChild(eventChips);

  // A pair's players; an individual's pairs, teams and groups — each section omitted when empty
  const playersSection = buildPlayersSection(pairMembers, openHandlers.openParticipant);
  if (playersSection) content.appendChild(playersSection);
  for (const section of buildMembershipSections(groupings, openHandlers)) content.appendChild(section);

  // Ranking points section (only if policies available)
  if (availablePolicies.length) {
    const sectionLabel = document.createElement('div');
    sectionLabel.style.cssText = 'font-weight: 600; margin-bottom: 0.5em; font-size: 0.95em;';
    sectionLabel.textContent = t('modals.participantProfile.rankingPoints');
    content.appendChild(sectionLabel);

    // Control bar container
    const controlElement = document.createElement('div');
    controlElement.className = 'controlBar flexrow flexcenter';
    controlElement.style.marginBottom = '0.5em';
    content.appendChild(controlElement);

    // Table container
    const tableElement = document.createElement('div');
    tableElement.className = 'tmxTable';
    tableElement.style.width = '100%';
    content.appendChild(tableElement);

    const onEventClick = (eventId: string) => {
      table?.destroy();
      cModal.close();
      navigateToEvent({ eventId, renderDraw: true });
    };
    const columns = getPointsColumns(onEventClick);

    const render = () => {
      const policy = getSelectedPolicy();
      lastData = computeData();

      if (table) {
        table.destroy();
        table = undefined;
      }

      let placeholder = 'No ranking points for this participant';
      if (policy?.requiresLevel && !selectedLevel) {
        placeholder = 'Select a tournament level to calculate ranking points';
      }

      table = new Tabulator(tableElement, {
        headerSortElement: headerSortElement([
          'eventName',
          'positionPoints',
          'perWinPoints',
          'bonusPoints',
          'qualityWinPoints',
          'points',
          'winCount',
          'rangeAccessor',
        ]),
        responsiveLayoutCollapseStartOpen: false,
        responsiveLayout: 'collapse',
        layout: 'fitColumns',
        reactiveData: true,
        height: '300px',
        placeholder,
        columns,
        data: lastData,
      });
    };

    render();

    const renderControlBar = () => {
      const policy = getSelectedPolicy();
      controlElement.innerHTML = '';
      controlElement.style.cssText = 'display: flex; align-items: center; gap: 0.25em;';

      const policyOptions = availablePolicies.map((p) => ({
        label: p.requiresLevel ? `${p.label} *` : p.label,
        close: true,
        active: p.id === selectedPolicyId,
        onClick: () => {
          selectedPolicyId = p.id;
          selectedLevel = undefined;
          render();
          renderControlBar();
        },
      }));

      const totalPoints = lastData.reduce((sum: number, r: any) => sum + (r.points || 0), 0);

      const leftEl = document.createElement('div');
      controlBar({
        target: leftEl,
        items: [
          {
            label: `Total: ${totalPoints}`,
            location: LEFT,
            intent: 'is-info',
          },
        ],
      });
      controlElement.appendChild(leftEl);

      const spacer = document.createElement('div');
      spacer.style.flex = '1';
      controlElement.appendChild(spacer);

      const policyEl = document.createElement('div');
      controlBar({
        target: policyEl,
        items: [
          {
            options: policyOptions,
            label: policy?.label || 'Select policy',
            modifyLabel: true,
            intent: 'is-info',
            location: RIGHT,
          },
        ],
      });
      controlElement.appendChild(policyEl);

      // Level selector — only shown when policy requires a level
      if (policy?.requiresLevel) {
        const levelOptions = policy.availableLevels.map((lvl) => ({
          label: getLevelDisplayLabel(lvl, policy),
          close: true,
          active: lvl === selectedLevel,
          onClick: () => {
            selectedLevel = lvl;
            render();
            renderControlBar();
          },
        }));

        const levelEl = document.createElement('div');
        controlBar({
          target: levelEl,
          items: [
            {
              options: levelOptions,
              label: selectedLevel ? getLevelDisplayLabel(selectedLevel, policy) : 'Select level',
              modifyLabel: true,
              location: RIGHT,
              intent: selectedLevel ? 'is-primary' : 'is-warning',
            },
          ],
        });
        controlElement.appendChild(levelEl);
      }
    };

    renderControlBar();
  }

  // Navigation support
  const hasList = participantIds && participantIds.length > 1;
  const currentIndex = hasList ? participantIds.indexOf(participantId) : -1;

  const navigate = (delta: number) => {
    if (!hasList || currentIndex < 0) return;
    const newIndex = currentIndex + delta;
    if (newIndex < 0 || newIndex >= participantIds.length) return;
    table?.destroy();
    cModal.close();
    participantProfileModal({ participantId: participantIds[newIndex], participantIds, readOnly });
  };

  if (hasList && currentIndex >= 0) {
    const navBar = document.createElement('div');
    navBar.style.cssText =
      'display: flex; align-items: center; justify-content: center; gap: 0.5em; margin-bottom: 1em;';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = t('modals.participantProfile.previous');
    prevBtn.style.cssText =
      'padding: 4px 12px; font-size: 12px; border-radius: 4px; border: 1px solid var(--tmx-border-secondary, #555); background: var(--tmx-bg-secondary, #333); color: var(--tmx-text-primary, #ccc); cursor: pointer;';
    if (currentIndex <= 0) {
      prevBtn.disabled = true;
      prevBtn.style.opacity = '0.3';
      prevBtn.style.cursor = 'default';
    }

    const counter = document.createElement('span');
    counter.style.cssText = 'font-size: 12px; color: var(--tmx-text-muted, #999);';
    counter.textContent = `${currentIndex + 1} of ${participantIds.length}`;

    const nextBtn = document.createElement('button');
    nextBtn.textContent = t('modals.participantProfile.next');
    nextBtn.style.cssText =
      'padding: 4px 12px; font-size: 12px; border-radius: 4px; border: 1px solid var(--tmx-border-secondary, #555); background: var(--tmx-bg-secondary, #333); color: var(--tmx-text-primary, #ccc); cursor: pointer;';
    if (currentIndex >= participantIds.length - 1) {
      nextBtn.disabled = true;
      nextBtn.style.opacity = '0.3';
      nextBtn.style.cursor = 'default';
    }

    prevBtn.addEventListener('click', () => navigate(-1));
    nextBtn.addEventListener('click', () => navigate(1));

    navBar.appendChild(prevBtn);
    navBar.appendChild(counter);
    navBar.appendChild(nextBtn);
    content.insertBefore(navBar, content.firstChild);
  }

  const onClose = () => {
    table?.destroy();
  };

  const navButtonStyle =
    'background-color: var(--tmx-bg-secondary, #333); color: var(--tmx-text-primary, #ccc); border: 1px solid var(--tmx-border-secondary, #555);';
  const buttons: any[] = [];

  if (hasList && currentIndex >= 0) {
    buttons.push(
      {
        label: t('modals.participantProfile.previous'),
        intent: 'none',
        close: false,
        disabled: currentIndex <= 0,
        onClick: () => navigate(-1),
        footer: { style: navButtonStyle },
      },
      {
        label: t('modals.participantProfile.next'),
        intent: 'none',
        close: false,
        disabled: currentIndex >= participantIds.length - 1,
        onClick: () => navigate(1),
        footer: { style: navButtonStyle },
      },
    );
  }

  buttons.push({ label: t('common.close'), close: true });

  cModal.open({
    title: escapeHtml(participant.participantName) || 'Participant Profile',
    content,
    buttons,
    config: { maxWidth: 1000 },
    onClose,
  });
}

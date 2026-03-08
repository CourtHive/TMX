/**
 * Participant Profile Modal — shows participant info, event entries,
 * ratings/rankings, and ranking point breakdown with policy + level selectors.
 */
import { getAvailablePolicies, getLevelDisplayLabel } from 'components/tables/pointsTable/policyUtils';
import { headerSortElement } from 'components/tables/common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { tournamentEngine, fixtures, factoryConstants } from 'tods-competition-factory';
import { controlBar, cModal } from 'courthive-components';

import { entryStatusMapping, LEFT, RIGHT } from 'constants/tmxConstants';

const { ratingsParameters } = fixtures;
const { SINGLES } = factoryConstants.eventConstants;

function getPointsColumns(): any[] {
  return [
    { title: 'Event', field: 'eventName', minWidth: 160, headerSort: true, responsive: 0 },
    { title: 'Finish', field: 'rangeAccessor', hozAlign: 'center', headerSort: true, width: 90, responsive: 2 },
    { title: 'Wins', field: 'winCount', hozAlign: 'center', headerSort: true, width: 70, responsive: 2 },
    {
      title: 'Position',
      field: 'positionPoints',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 1,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: 'Per Win',
      field: 'perWinPoints',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 2,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: 'Bonus',
      field: 'bonusPoints',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 2,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: 'Quality',
      field: 'qualityWinPoints',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 3,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: 'Total',
      field: 'points',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 0,
      formatter: (cell: any) => {
        const val = cell.getValue();
        return val ? `<strong>${val}</strong>` : '';
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
    locationEl.innerHTML = `<i class="fas fa-map-marker-alt" style="margin-right: 0.3em;"></i>${cityState}`;
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

function buildEventChips(participant: any): HTMLElement | undefined {
  const participantEvents = participant.events || [];
  if (!participantEvents.length) return undefined;

  const allEvents = tournamentEngine.getEvents()?.events || [];
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
  const chip = document.createElement('span');
  chip.style.cssText = `
    display: inline-flex; align-items: center; gap: 0.3em;
    padding: 0.25em 0.6em; border-radius: 4px; font-size: 0.85em;
    background: ${color || '#eee'}22; border: 1px solid ${color || '#ccc'}44;
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

// --- Main export ---

type ParticipantProfileParams = {
  participantId: string;
};

export function participantProfileModal({ participantId }: ParticipantProfileParams): void {
  const result = tournamentEngine.getParticipants({
    participantFilters: { participantIds: [participantId] },
    withRankingProfile: true,
    withScaleValues: true,
    withEvents: true,
    withISO2: true,
  });
  const participant = result?.participants?.[0];
  if (!participant) return;

  const personId = participant.person?.personId;
  const participantEventIds = (participant.events ?? []).map((e: any) => e.eventId);
  const allEvents = tournamentEngine.getEvents()?.events || [];

  const availablePolicies = getAvailablePolicies();
  let selectedPolicyId = availablePolicies[0]?.id;
  let selectedLevel: number | undefined;
  let table: any;
  let lastData: any[] = [];

  const getSelectedPolicy = () => availablePolicies.find((p) => p.id === selectedPolicyId);

  const computeData = () => {
    const policy = getSelectedPolicy();
    if (!policy) return [];
    if (policy.requiresLevel && !selectedLevel) return [];

    const rows: any[] = [];
    for (const eventId of participantEventIds) {
      const res = tournamentEngine.getEventRankingPoints({
        policyDefinitions: policy.policyData,
        level: selectedLevel,
        eventId,
      });
      if (!res?.success) continue;

      const eventName = res.eventName;
      const awards = (res.eventAwards || []).filter(
        (a: any) => a.participantId === participantId || a.personId === personId,
      );

      if (awards.length) {
        for (const award of awards) rows.push({ ...award, eventName });
      } else {
        const evt = allEvents.find((e: any) => e.eventId === eventId);
        rows.push({ eventName: evt?.eventName || eventName || eventId, points: 0 });
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

  // Event entry chips
  const eventChips = buildEventChips(participant);
  if (eventChips) content.appendChild(eventChips);

  // Ranking points section (only if policies available)
  if (availablePolicies.length) {
    const sectionLabel = document.createElement('div');
    sectionLabel.style.cssText = 'font-weight: 600; margin-bottom: 0.5em; font-size: 0.95em;';
    sectionLabel.textContent = 'Ranking Points';
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

    const columns = getPointsColumns();

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

      const items: any[] = [
        {
          label: `Total: ${totalPoints}`,
          location: LEFT,
          intent: 'is-info',
        },
        {
          options: policyOptions,
          label: policy?.label || 'Select policy',
          modifyLabel: true,
          location: RIGHT,
        },
      ];

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

        items.push({
          options: levelOptions,
          label: selectedLevel ? getLevelDisplayLabel(selectedLevel, policy) : 'Select level',
          modifyLabel: true,
          location: RIGHT,
          intent: !selectedLevel ? 'is-warning' : undefined,
        });
      }

      controlBar({ target: controlElement, items });
    };

    renderControlBar();
  }

  const onClose = () => {
    table?.destroy();
  };

  cModal.open({
    title: participant.participantName || 'Participant Profile',
    content,
    buttons: [{ label: 'Close', close: true }],
    config: { maxWidth: 1000 },
    onClose,
  });
}

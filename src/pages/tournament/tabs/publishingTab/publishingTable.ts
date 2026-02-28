/**
 * Events/Draws publishing tree table using Tabulator dataTree.
 * Shows hierarchical event > draw rows with publish toggles, embargo pickers,
 * clickable names (navigate to draw), and public URL links.
 */
import { getPublicEventUrl, getPublicDrawUrl } from 'services/publishing/publicUrl';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { tournamentEngine, publishingGovernor } from 'tods-competition-factory';
import { renderPublishingTab } from './renderPublishingTab';
import { getPublishingTableData } from './publishingData';
import { openEmbargoModal } from './embargoModal';
import { t } from 'i18n';

// constants
import { PUBLISH_EVENT, UNPUBLISH_EVENT } from 'constants/mutationConstants';

const TABLE_ID = 'publishingEventsTable';

function getRowPublicUrl(data: any): string | undefined {
  const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
  if (!tournamentId) return undefined;
  if (data.type === 'draw' && data.drawId) {
    return getPublicDrawUrl({ tournamentId, eventId: data.eventId, drawId: data.drawId });
  }
  if (data.type === 'event') {
    return getPublicEventUrl({ tournamentId, eventId: data.eventId });
  }
  return undefined;
}

function stateFormatter(cell: any): string {
  const state = cell.getValue();
  if (state === 'live') {
    const data = cell.getRow().getData();
    const url = getRowPublicUrl(data);
    if (url) {
      return `<a href="${url}" target="_blank" rel="noopener" class="pub-state-badge pub-state-live" style="text-decoration:none; cursor:pointer;"><i class="fa fa-eye"></i> ${t('publishing.live')}</a>`;
    }
    return `<span class="pub-state-badge pub-state-live"><i class="fa fa-eye"></i> ${t('publishing.live')}</span>`;
  }
  if (state === 'embargoed') {
    return `<span class="pub-state-badge pub-state-embargoed"><i class="fa fa-clock"></i> ${t('publishing.embargoed')}</span>`;
  }
  return `<span class="pub-state-badge pub-state-off"><i class="fa fa-eye-slash"></i> ${t('publishing.off')}</span>`;
}

function toggleFormatter(cell: any): string {
  const data = cell.getRow().getData();
  if (data.type === 'round' && data.scheduleEmbargoActive) {
    return '<i class="fa-solid fa-clock" style="color: var(--tmx-accent-orange); cursor:default; font-size:1.1rem;"></i>';
  }
  const published = cell.getValue();
  return published
    ? '<i class="fa-solid fa-eye" style="color: var(--tmx-accent-blue); cursor:pointer; font-size:1.1rem;"></i>'
    : '<i class="fa-solid fa-eye-slash" style="color: var(--tmx-accent-red); cursor:pointer; font-size:1.1rem;"></i>';
}

function nameFormatter(cell: any): string {
  const name = cell.getValue();
  return `<span style="cursor:pointer; text-decoration:underline; text-decoration-color:var(--tmx-text-muted); text-underline-offset:2px;">${name}</span>`;
}

function publicUrlFormatter(cell: any): string {
  const data = cell.getRow().getData();
  const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
  if (!tournamentId) return '';

  let url: string | undefined;
  if (data.type === 'draw' && data.drawId) {
    url = getPublicDrawUrl({ tournamentId, eventId: data.eventId, drawId: data.drawId });
  } else if (data.type === 'event') {
    url = getPublicEventUrl({ tournamentId, eventId: data.eventId });
  }

  if (url) {
    return `<a href="${url}" target="_blank" rel="noopener" style="color:var(--tmx-accent-blue); font-size:1rem;"><i class="fa fa-arrow-up-right-from-square"></i></a>`;
  }
  return '<span style="color:var(--tmx-text-muted); font-size:0.85rem;">—</span>';
}

function formatLocalEmbargo(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function embargoFormatter(cell: any): string {
  const embargo = cell.getValue();
  if (!embargo) return '<span style="color:var(--tmx-text-muted); font-size:0.8rem;">—</span>';
  const date = new Date(embargo);
  const now = Date.now();
  const active = date.getTime() > now;
  if (!active) return `<span style="color:var(--tmx-text-muted); font-size:0.8rem;">${t('publishing.expired')}</span>`;
  const localStr = formatLocalEmbargo(date);
  return `<span style="color:var(--tmx-accent-orange); font-size:0.8rem;" title="${localStr}"><i class="fa fa-clock"></i> ${localStr}</span>`;
}

function handleNameClick(cell: any): void {
  const data = cell.getRow().getData();
  if (data.type === 'draw' && data.drawId) {
    navigateToEvent({ eventId: data.eventId, drawId: data.drawId, renderDraw: true });
  } else if (data.type === 'event') {
    navigateToEvent({ eventId: data.eventId });
  }
}

function handlePublishToggle(cell: any): void {
  const row = cell.getRow();
  const data = row.getData();

  const eventDataParams = {
    participantsProfile: { withScaleValues: true },
    pressureRating: true,
    refreshResults: true,
  };

  if (data.type === 'event') {
    const method = data.published ? UNPUBLISH_EVENT : PUBLISH_EVENT;
    mutationRequest({
      methods: [{ method, params: { eventId: data.eventId, eventDataParams } }],
      callback: () => renderPublishingTab(),
    });
  } else if (data.type === 'draw') {
    const drawIdsToAdd = data.published ? undefined : [data.drawId];
    const drawIdsToRemove = data.published ? [data.drawId] : undefined;
    mutationRequest({
      methods: [
        { method: PUBLISH_EVENT, params: { eventId: data.eventId, drawIdsToAdd, drawIdsToRemove, eventDataParams } },
      ],
      callback: () => renderPublishingTab(),
    });
  } else if (data.type === 'round' && data.structureId && data.roundLimit != null) {
    // Toggle round visibility via roundLimit
    const { event } = tournamentEngine.getEvent({ drawId: data.drawId });
    if (!event) return;
    const pubState = publishingGovernor.getPublishState({ event })?.publishState;
    const structureDetail = pubState?.status?.drawDetails?.[data.drawId]?.structureDetails?.[data.structureId] || {};

    // Currently hidden — show it by raising roundLimit to include this round
    const newLimit = data.roundNumber; // show up to this round
    const drawDef = event.drawDefinitions?.find((dd: any) => dd.drawId === data.drawId);
    const structure = drawDef?.structures?.find((s: any) => s.structureId === data.structureId);
    const matchUps = structure?.matchUps || [];
    const maxRound = matchUps.reduce((max: number, m: any) => Math.max(max, m.roundNumber || 0), 0);

    const updatedDetail: any = { ...structureDetail, published: true };
    if (newLimit >= 0 && newLimit < maxRound) {
      updatedDetail.roundLimit = newLimit;
    } else {
      delete updatedDetail.roundLimit;
    }

    mutationRequest({
      methods: [
        {
          method: PUBLISH_EVENT,
          params: {
            removePriorValues: true,
            drawDetails: { [data.drawId]: { structureDetails: { [data.structureId]: updatedDetail } } },
            eventId: data.eventId,
            eventDataParams,
          },
        },
      ],
      callback: () => renderPublishingTab(),
    });
  }
}

function handleEmbargoClick(cell: any): void {
  const row = cell.getRow();
  const data = row.getData();

  const eventDataParams = {
    participantsProfile: { withScaleValues: true },
    pressureRating: true,
    refreshResults: true,
  };

  if (data.type === 'round' && data.structureId && data.roundNumber) {
    // Round-level schedule embargo
    const { event } = tournamentEngine.getEvent({ drawId: data.drawId });
    if (!event) return;
    const pubState = publishingGovernor.getPublishState({ event })?.publishState;
    const structureDetail = pubState?.status?.drawDetails?.[data.drawId]?.structureDetails?.[data.structureId] || {};
    const currentScheduledRounds = structureDetail.scheduledRounds || {};

    openEmbargoModal({
      title: t('publishing.embargoRoundSchedule', { roundNumber: data.roundNumber }),
      currentEmbargo: data.scheduleEmbargo,
      onSet: (isoString) => {
        const scheduledRounds = {
          ...currentScheduledRounds,
          [data.roundNumber]: { published: true, embargo: isoString },
        };
        mutationRequest({
          methods: [
            {
              method: PUBLISH_EVENT,
              params: {
                removePriorValues: true,
                drawDetails: {
                  [data.drawId]: { structureDetails: { [data.structureId]: { ...structureDetail, scheduledRounds } } },
                },
                eventId: data.eventId,
                eventDataParams,
              },
            },
          ],
          callback: () => renderPublishingTab(),
        });
      },
      onClear: data.scheduleEmbargo
        ? () => {
            const scheduledRounds = { ...currentScheduledRounds, [data.roundNumber]: { published: true } };
            mutationRequest({
              methods: [
                {
                  method: PUBLISH_EVENT,
                  params: {
                    removePriorValues: true,
                    drawDetails: {
                      [data.drawId]: {
                        structureDetails: { [data.structureId]: { ...structureDetail, scheduledRounds } },
                      },
                    },
                    eventId: data.eventId,
                    eventDataParams,
                  },
                },
              ],
              callback: () => renderPublishingTab(),
            });
          }
        : undefined,
    });
    return;
  }

  if (data.type !== 'draw') return;

  openEmbargoModal({
    title: `${t('publishing.embargo')}: ${data.name}`,
    currentEmbargo: data.embargo,
    onSet: (isoString) => {
      const drawDetails: Record<string, any> = {};
      drawDetails[data.drawId] = {
        publishingDetail: { published: true, embargo: isoString },
      };
      mutationRequest({
        methods: [
          {
            method: PUBLISH_EVENT,
            params: { eventId: data.eventId, drawIdsToAdd: [data.drawId], drawDetails, eventDataParams },
          },
        ],
        callback: () => renderPublishingTab(),
      });
    },
    onClear: data.embargo
      ? () => {
          const drawDetails: Record<string, any> = {};
          drawDetails[data.drawId] = {
            publishingDetail: { published: data.published },
          };
          mutationRequest({
            methods: [
              {
                method: PUBLISH_EVENT,
                params: { eventId: data.eventId, drawIdsToAdd: [data.drawId], drawDetails, eventDataParams },
              },
            ],
            callback: () => renderPublishingTab(),
          });
        }
      : undefined,
  });
}

function handleScheduleEmbargoClick(cell: any): void {
  const row = cell.getRow();
  const data = row.getData();

  if (data.type === 'round') {
    handleEmbargoClick(cell);
    return;
  }

  if (data.type !== 'draw') return;

  const eventDataParams = {
    participantsProfile: { withScaleValues: true },
    pressureRating: true,
    refreshResults: true,
  };

  // Draw-level schedule embargo: applies to all rounds in all structures
  const { event } = tournamentEngine.getEvent({ drawId: data.drawId });
  if (!event) return;
  const pubState = publishingGovernor.getPublishState({ event })?.publishState;
  const drawDetail = pubState?.status?.drawDetails?.[data.drawId] || {};
  const drawDef = event.drawDefinitions?.find((dd: any) => dd.drawId === data.drawId);
  const structures = drawDef?.structures || [];

  // Find existing draw-level schedule embargo (from first structure's first round, or undefined)
  const existingStructureDetails = drawDetail.structureDetails || {};
  let currentScheduleEmbargo: string | undefined;
  for (const [, sd] of Object.entries(existingStructureDetails) as [string, any][]) {
    const scheduledRounds = sd?.scheduledRounds || {};
    for (const [, rd] of Object.entries(scheduledRounds) as [string, any][]) {
      if (rd?.embargo && new Date(rd.embargo).getTime() > Date.now()) {
        currentScheduleEmbargo = rd.embargo;
        break;
      }
    }
    if (currentScheduleEmbargo) break;
  }

  openEmbargoModal({
    title: `${t('publishing.embargo')}: ${data.name} ${t('publishing.roundSchedule').toLowerCase()}`,
    currentEmbargo: currentScheduleEmbargo,
    onSet: (isoString) => {
      // Set schedule embargo on all rounds in all structures
      const structureDetails: Record<string, any> = {};
      for (const structure of structures) {
        const matchUps = structure.matchUps || [];
        const maxRound = matchUps.reduce((max: number, m: any) => Math.max(max, m.roundNumber || 0), 0);
        const existingDetail = existingStructureDetails[structure.structureId] || {};
        const scheduledRounds: Record<string, any> = {};
        for (let rn = 1; rn <= maxRound; rn++) {
          scheduledRounds[rn] = { published: true, embargo: isoString };
        }
        structureDetails[structure.structureId] = { ...existingDetail, scheduledRounds };
      }

      mutationRequest({
        methods: [
          {
            method: PUBLISH_EVENT,
            params: {
              removePriorValues: true,
              drawDetails: { [data.drawId]: { ...drawDetail, structureDetails } },
              eventId: data.eventId,
              eventDataParams,
            },
          },
        ],
        callback: () => renderPublishingTab(),
      });
    },
    onClear: currentScheduleEmbargo
      ? () => {
          // Clear schedule embargoes from all rounds in all structures
          const structureDetails: Record<string, any> = {};
          for (const structure of structures) {
            const existingDetail = existingStructureDetails[structure.structureId] || {};
            const existingScheduledRounds = existingDetail.scheduledRounds || {};
            const scheduledRounds: Record<string, any> = {};
            for (const [rn] of Object.entries(existingScheduledRounds)) {
              scheduledRounds[rn] = { published: true };
            }
            structureDetails[structure.structureId] = { ...existingDetail, scheduledRounds };
          }

          mutationRequest({
            methods: [
              {
                method: PUBLISH_EVENT,
                params: {
                  removePriorValues: true,
                  drawDetails: { [data.drawId]: { ...drawDetail, structureDetails } },
                  eventId: data.eventId,
                  eventDataParams,
                },
              },
            ],
            callback: () => renderPublishingTab(),
          });
        }
      : undefined,
  });
}

function getColumns(): any[] {
  return [
    {
      title: t('publishing.name'),
      field: 'name',
      formatter: nameFormatter,
      cellClick: (_: any, cell: any) => handleNameClick(cell),
      widthGrow: 3,
      minWidth: 200,
    },
    {
      title: t('publishing.type'),
      field: 'type',
      width: 80,
      formatter: (cell: any) => {
        const type = cell.getValue();
        if (type === 'event') return t('publishing.event');
        if (type === 'round') return t('publishing.round');
        return t('publishing.draw');
      },
    },
    {
      title: '<i class="fa fa-toggle-on"></i>',
      field: 'published',
      formatter: toggleFormatter,
      cellClick: (_: any, cell: any) => handlePublishToggle(cell),
      headerSort: false,
      hozAlign: 'left',
      width: 55,
    },
    {
      title: t('publishing.status'),
      field: 'publishState',
      formatter: stateFormatter,
      cellClick: (_: any, cell: any) => {
        const data = cell.getRow().getData();
        if (data.publishState === 'live') {
          const url = getRowPublicUrl(data);
          if (url) window.open(url, '_blank');
        }
      },
      headerSort: false,
      width: 120,
    },
    {
      title: '<i class="fa fa-arrow-up-right-from-square"></i>',
      field: 'publicUrl',
      formatter: publicUrlFormatter,
      headerSort: false,
      hozAlign: 'left',
      width: 50,
    },
    {
      title: t('publishing.embargo'),
      field: 'embargo',
      formatter: embargoFormatter,
      cellClick: (_: any, cell: any) => handleEmbargoClick(cell),
      headerSort: false,
      width: 170,
    },
    {
      title: '<i class="fa fa-calendar"></i>',
      headerTooltip: t('publishing.scheduleEmbargo'),
      field: 'scheduleEmbargo',
      formatter: (cell: any) => {
        const data = cell.getRow().getData();
        if (data.type !== 'round' || !data.scheduleEmbargo) {
          return '<span style="color:var(--tmx-text-muted); font-size:0.8rem;">—</span>';
        }
        return embargoFormatter(cell);
      },
      cellClick: (_: any, cell: any) => handleScheduleEmbargoClick(cell),
      headerSort: false,
      width: 170,
    },
  ];
}

export function renderPublishingTable(grid: HTMLElement): void {
  const panel = document.createElement('div');
  panel.className = 'pub-panel pub-panel-blue pub-grid-full';

  const header = document.createElement('h3');
  header.innerHTML = `<i class="fa fa-sitemap"></i> ${t('publishing.eventsAndDraws')}`;
  panel.appendChild(header);

  const tableEl = document.createElement('div');
  tableEl.id = TABLE_ID;
  panel.appendChild(tableEl);

  grid.appendChild(panel);

  const data = getPublishingTableData();

  new Tabulator(tableEl, {
    dataTree: true,
    dataTreeStartExpanded: true,
    dataTreeChildField: '_children',
    layout: 'fitColumns',
    placeholder: t('publishing.noEvents'),
    index: 'id',
    height: Math.min(data.length * 80 + 60, window.innerHeight * 0.5),
    columns: getColumns(),
    data,
  });
}

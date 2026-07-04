import { eventConstants, genderConstants } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';

const { SINGLES, DOUBLES, TEAM } = eventConstants;
const { MIXED, ANY, OTHER } = genderConstants;

// Single-gender (participant's own) events first, then mixed, then any/other/unknown.
const genderRank = (gender?: string): number => {
  const g = gender?.toUpperCase();
  if (g === MIXED) return 1;
  if (!g || g === ANY || g === OTHER) return 2;
  return 0;
};

// Singles before Doubles before Team.
const eventTypeOrder: Record<string, number> = { [SINGLES]: 0, [DOUBLES]: 1, [TEAM]: 2 };
const eventTypeRank = (eventType?: string): number => eventTypeOrder[eventType ?? ''] ?? 3;

export const eventsFormatter = (eventClick?: (params: any) => void) => (cell: any): HTMLDivElement => {
  const def = cell.getColumn().getDefinition();
  const content = document.createElement('div');
  content.className = 'tags';

  const events = cell.getValue();
  const rowData = cell.getRow().getData();
  const { participantId } = rowData;
  const eventSorter = (a: any, b: any) =>
    genderRank(a?.gender) - genderRank(b?.gender) ||
    eventTypeRank(a?.eventType) - eventTypeRank(b?.eventType) ||
    (a?.eventName ?? '').localeCompare(b?.eventName ?? '', undefined, { numeric: true });
  events.sort(eventSorter).forEach((event: any) => {
    const pill = createPill({ def, participantId, event, eventClick });
    content.appendChild(pill);
  });

  return content;
};

function createPill({ matchUpId, participantId, event, eventClick }: { matchUpId?: string; participantId?: string; event: any; eventClick?: (params: any) => void; def?: any }): HTMLSpanElement {
  const pill = document.createElement('span');
  if (isFunction(eventClick) && eventClick) {
    pill.onclick = () => eventClick({ eventId: event.eventId, participantId, matchUpId });
  }
  pill.className = 'tag event-pill';
  if (event.gender?.toLowerCase().includes('female')) {
    pill.classList.add('is-danger');
  } else if (event.gender?.toLowerCase().includes('male')) {
    pill.classList.add('is-link');
  } else {
    pill.classList.add('is-primary');
  }
  if (event.eventType === SINGLES) {
    pill.classList.add('is-light');
  }
  pill.innerHTML = event.eventName;
  return pill;
}

export const eventFormatter = (eventClick?: (params: any) => void) => (cell: any): HTMLDivElement => {
  const def = cell.getColumn().getDefinition();
  const rowData = cell.getRow().getData();
  const { matchUpId } = rowData;

  const content = document.createElement('div');
  content.className = 'tags';
  const pill = createPill({ def, matchUpId, event: rowData, eventClick });
  content.append(pill);

  return content;
};

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function nowHm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Status = 'future' | 'past' | 'none';

function dateStatus(scheduledDate?: string): Status {
  if (!scheduledDate) return 'none';
  const today = todayYmd();
  if (scheduledDate < today) return 'past';
  return 'future';
}

function dateTimeStatus(scheduledDate?: string, scheduledTime?: string): Status {
  if (!scheduledDate && !scheduledTime) return 'none';
  if (!scheduledDate) return 'future';
  const today = todayYmd();
  if (scheduledDate < today) return 'past';
  if (scheduledDate > today) return 'future';
  if (!scheduledTime) return 'future';
  return scheduledTime < nowHm() ? 'past' : 'future';
}

function styleForStatus(status: Status): string {
  if (status === 'future') return 'color:var(--tmx-accent-green);font-weight:600;';
  if (status === 'past') return 'opacity:0.55;';
  return '';
}

export function scheduleDateFormatter(cell: any): HTMLSpanElement | string {
  const value = cell.getValue();
  if (!value) return '';
  const el = document.createElement('span');
  el.style.cssText = styleForStatus(dateStatus(value));
  el.textContent = value;
  return el;
}

export function scheduleTimeFormatter(cell: any): HTMLSpanElement | string {
  const value = cell.getValue();
  if (!value) return '';
  const data = cell.getRow().getData();
  const el = document.createElement('span');
  el.style.cssText = styleForStatus(dateTimeStatus(data?.scheduledDate, value));
  el.textContent = value;
  return el;
}

// `calledAt` is a full ISO timestamp (stamped when a matchUp is dropped on the
// active strip), unlike scheduledTime's bare HH:MM — render it as local HH:MM.
export function calledAtFormatter(cell: any): HTMLSpanElement | string {
  const value = cell.getValue();
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const el = document.createElement('span');
  el.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return el;
}

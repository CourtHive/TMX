/**
 * Compact segmented bar showing competitiveness distribution for the
 * currently visible matchUps. Same buckets as the overview donut chart
 * (@courthive/scoring-visualizations donutChartFromMatchUps); colors
 * mirror the profile-column accent vars.
 */

const BUCKETS = ['COMPETITIVE', 'ROUTINE', 'DECISIVE', 'WALKOVER'] as const;
type Bucket = (typeof BUCKETS)[number];

const COLOR_MAP: Record<Bucket, string> = {
  COMPETITIVE: 'var(--tmx-accent-green)',
  ROUTINE: 'var(--tmx-accent-blue)',
  DECISIVE: 'var(--tmx-accent-purple)',
  WALKOVER: 'var(--tmx-text-muted, #888)',
};

const LABEL_MAP: Record<Bucket, string> = {
  COMPETITIVE: 'Competitive',
  ROUTINE: 'Routine',
  DECISIVE: 'Decisive',
  WALKOVER: 'Walkover / Defaulted',
};

const WALKOVER_STATUSES = new Set(['WALKOVER', 'DOUBLE_WALKOVER', 'DEFAULTED', 'DOUBLE_DEFAULT']);

function aggregate(rows: any[]): Record<Bucket, number> {
  const counts: Record<Bucket, number> = { COMPETITIVE: 0, ROUTINE: 0, DECISIVE: 0, WALKOVER: 0 };
  for (const row of rows) {
    const data = typeof row?.getData === 'function' ? row.getData() : row;
    if (!data) continue;
    if (data.matchUpStatus && WALKOVER_STATUSES.has(data.matchUpStatus)) {
      counts.WALKOVER += 1;
      continue;
    }
    const c = data.competitiveProfile?.competitiveness as Bucket | undefined;
    if (c && c !== 'WALKOVER' && c in counts) counts[c] += 1;
  }
  return counts;
}

export function createCompetitivenessSummary(): { element: HTMLElement; update: (rows: any[]) => void } {
  const element = document.createElement('div');
  element.className = 'matchups-competitiveness-summary';
  element.style.cssText =
    'flex: 1 1 auto; max-width: 600px; min-width: 0; height: 1.5em; ' +
    'display: none; flex-direction: row; gap: 2px; align-items: stretch; overflow: hidden;';

  const segments: Record<Bucket, HTMLElement> = {} as any;
  for (const b of BUCKETS) {
    const seg = document.createElement('div');
    seg.dataset.bucket = b;
    seg.style.cssText =
      `background: ${COLOR_MAP[b]}; color: white; ` +
      'font-size: 0.85em; font-weight: 600; line-height: 1; ' +
      'display: flex; align-items: center; justify-content: center; ' +
      'min-width: 0; overflow: hidden; border-radius: 2px; ' +
      'flex: 0 0 0; padding: 0;';
    segments[b] = seg;
    element.appendChild(seg);
  }

  const update = (rows: any[]) => {
    const counts = aggregate(rows);
    const total = BUCKETS.reduce((s, b) => s + counts[b], 0);
    element.style.display = total > 0 ? 'flex' : 'none';
    if (!total) return;

    for (const b of BUCKETS) {
      const seg = segments[b];
      const count = counts[b];
      if (count === 0) {
        seg.style.flex = '0 0 0';
        seg.style.padding = '0';
        seg.textContent = '';
        seg.removeAttribute('title');
      } else {
        seg.style.flex = `${count} 1 0`;
        seg.style.padding = '0 4px';
        seg.textContent = String(count);
        seg.title = `${LABEL_MAP[b]}: ${count}`;
      }
    }
  };

  return { element, update };
}

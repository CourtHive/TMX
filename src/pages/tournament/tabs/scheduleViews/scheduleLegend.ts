/**
 * Schedule2 — the legend behind the footer's info icon.
 *
 * The scheduling page has grown a vocabulary nobody is told. A card can say
 * `on court`, `41m`, `rest unknown` or `no prior match`, and carry a `#3`
 * riding the badge; an Inspector row can end in `(est.)` or in
 * `Could not read: score entry`; a cell can wear a check-in count or an
 * annotation pill. Every one of those is legible once explained and opaque
 * until then, and none of them has anywhere to explain itself — a tooltip
 * expands the value, not the vocabulary.
 *
 * So: one popover, reachable from the footer, that lists the marks and says
 * what each one means. Deliberately a legend and not documentation — it names
 * what is on screen and stops. Anything that needs a paragraph belongs in the
 * Inspector, which already has the room for it.
 *
 * **The sample chips are rendered from the same `t()` keys the real ones use.**
 * A legend that hard-codes its own copy of "on court" is a second source of
 * truth for the word, and drifts the first time either side is reworded. The
 * explanation beside each is the only new copy here.
 */
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { t } from 'i18n';

const LEGEND_ROW_GAP = '8px';

export interface LegendRow {
  /** The mark as it appears on the page. */
  sample: string;
  /** What it tells the operator. */
  meaning: string;
  /** Rendered as a chip rather than plain text — true for the badge vocabulary. */
  chip?: boolean;
}

export interface LegendSection {
  heading: string;
  rows: LegendRow[];
}

/**
 * The legend as data, with no DOM anywhere near it.
 *
 * Separated from the rendering for the reason the rest badge is: the content is
 * the part worth testing, and TMX tests DOM construction in Playwright rather
 * than in a simulated document (the ecosystem's no-happy-dom rule). This shape
 * is assertable in a unit test; the nodes below are covered by a journey.
 */
export function legendSections(): LegendSection[] {
  return [
    {
      heading: t('schedule.legend.restBadge'),
      rows: [
        { sample: t('schedule.card.rest.onCourt'), meaning: t('schedule.legend.restOnCourt'), chip: true },
        { sample: t('schedule.legend.restDurationSample'), meaning: t('schedule.legend.restDuration'), chip: true },
        { sample: t('schedule.card.rest.unknown'), meaning: t('schedule.legend.restUnknown'), chip: true },
        { sample: t('schedule.card.rest.none'), meaning: t('schedule.legend.restNone'), chip: true },
        {
          sample: t('schedule.card.rest.limit', { ordinal: 3 }),
          meaning: t('schedule.legend.restLimit'),
          chip: true,
        },
      ],
    },
    {
      heading: t('schedule.legend.inspector'),
      rows: [
        { sample: t('schedule.legend.estimatedSample'), meaning: t('schedule.legend.estimated') },
        {
          sample: t('schedule.inspector.rest.discarded', {
            rungs: t('schedule.inspector.rest.discardedName.scoredTime'),
          }),
          meaning: t('schedule.legend.discarded'),
        },
      ],
    },
    {
      heading: t('schedule.legend.cellMarks'),
      rows: [
        { sample: t('checkIn.badgePartial', { count: 1 }), meaning: t('schedule.legend.checkIn'), chip: true },
        { sample: t('schedule.annotations'), meaning: t('schedule.legend.annotations') },
      ],
    },
  ];
}

function buildChip(text: string): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'tmx-legend-chip';
  chip.textContent = text;
  return chip;
}

function buildRow(row: LegendRow): HTMLElement {
  const element = document.createElement('div');
  element.className = 'tmx-legend-row';

  const sample = document.createElement('div');
  sample.className = 'tmx-legend-sample';
  if (row.chip) sample.appendChild(buildChip(row.sample));
  else sample.textContent = row.sample;

  const meaning = document.createElement('div');
  meaning.className = 'tmx-legend-meaning';
  meaning.textContent = row.meaning;

  element.append(sample, meaning);
  return element;
}

const LEGEND_STYLE_ID = 'tmx-schedule-legend-style';

/**
 * Injected once rather than written inline on every node: the popover has ~9
 * rows and the chip needs a pseudo-free but themed box, and `--tmx-*` tokens
 * resolve the same in a stylesheet as they do inline while staying readable.
 * Every colour is a theme token, so light and dark both follow the page.
 */
function ensureLegendStyle(): void {
  if (document.getElementById(LEGEND_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LEGEND_STYLE_ID;
  style.textContent = [
    `.tmx-legend{padding:8px;max-height:60vh;overflow-y:auto;min-width:300px;max-width:380px}`,
    `.tmx-legend-heading{font-weight:700;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em;`,
    `color:var(--tmx-text-secondary);margin:10px 0 4px}`,
    `.tmx-legend-heading:first-child{margin-top:0}`,
    `.tmx-legend-row{display:flex;gap:${LEGEND_ROW_GAP};align-items:baseline;padding:3px 0}`,
    `.tmx-legend-sample{flex:0 0 40%;font-size:0.75rem;color:var(--tmx-text-primary)}`,
    `.tmx-legend-meaning{flex:1;font-size:0.75rem;color:var(--tmx-text-secondary)}`,
    `.tmx-legend-chip{display:inline-block;padding:1px 6px;border-radius:10px;font-size:0.6875rem;`,
    `background:var(--tmx-bg-tertiary);border:1px solid var(--tmx-border-primary);color:var(--tmx-text-primary);`,
    `white-space:nowrap}`,
  ].join('');
  document.head.appendChild(style);
}

/** The popover body. Exported for the unit test, which asserts every row is explained. */
export function buildSchedulePopoverLegend(): HTMLElement {
  ensureLegendStyle();
  const container = document.createElement('div');
  container.className = 'tmx-legend';

  for (const section of legendSections()) {
    const heading = document.createElement('div');
    heading.className = 'tmx-legend-heading';
    heading.textContent = section.heading;
    container.appendChild(heading);
    for (const row of section.rows) container.appendChild(buildRow(row));
  }

  return container;
}

/**
 * The footer's info icon. Built on the same tippy-on-click shape as the issues
 * button beside it, so the two read as one family of footer affordances.
 */
export function buildLegendButton(): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tmx-legend-button';
  btn.title = t('schedule.legend.title');
  btn.setAttribute('aria-label', t('schedule.legend.title'));
  btn.style.cssText = [
    'font-size: 0.875rem',
    'padding: 4px 8px',
    'border-radius: 6px',
    'border: 1px solid var(--tmx-border-primary)',
    'background: var(--tmx-bg-primary)',
    'cursor: pointer',
    'color: var(--tmx-text-secondary)',
    'display: inline-flex',
    'align-items: center',
  ].join('; ');
  btn.innerHTML = '<i class="fa-solid fa-circle-info"></i>';

  let instance: TippyInstance | undefined;
  requestAnimationFrame(() => {
    instance = tippy(btn, {
      // Built per open: the rows are `t()` calls, so a language change between
      // opens must be picked up rather than baked in at construction.
      content: () => buildSchedulePopoverLegend(),
      trigger: 'click',
      interactive: true,
      placement: 'top-end',
      theme: 'light-border',
      appendTo: () => document.body,
      maxWidth: 400,
    });
    void instance; //NOSONAR
  });

  return btn;
}

/**
 * Venues tab — Transit view (`/tournament/:id/venues/transit`).
 *
 * How long it takes to get from one venue to another: the scheduler will not give a participant a next matchUp at
 * another venue before the earlier one ends plus the greater of their recovery and the transit (factory
 * scheduling-pipeline.md § 3.4). Two linked pictures of the same data: a network of the venues (placed by their
 * coordinates when they have them), each edge labelled with its minutes and styled by where they come from, and a
 * from × to matrix. Selecting an edge or a cell opens the editor for that direction.
 */

import { REMOVE_VENUE_TRANSIT, SET_VENUE_TRANSIT } from 'constants/mutationConstants';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { policyConstants } from 'tods-competition-factory';
import { t } from 'i18n';

import type { DirectedTransit, Point, TransitEdge, TransitInputs, TransitSource } from './transitModel';
import {
  directedTransit,
  formatMinutes,
  layoutVenues,
  policyDefaultTransitMinutes,
  transitEdges,
  transitInputsFromRecord,
  validateTransitMinutes,
} from './transitModel';

import './transitView.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
const { POLICY_TYPE_SCHEDULING } = policyConstants;
const NETWORK_WIDTH = 560;
const NETWORK_HEIGHT = 420;
const NODE_RADIUS = 22;
const SELECTED = 'is-selected';

type Selection = { from: string; to: string };

function readInputs(): TransitInputs {
  const { tournamentRecord }: any = tournamentEngine.getTournament() ?? {};
  const appliedPolicies: any = tournamentEngine.getAppliedPolicies({
    policyTypes: [POLICY_TYPE_SCHEDULING],
  })?.appliedPolicies;
  return transitInputsFromRecord(tournamentRecord, policyDefaultTransitMinutes(appliedPolicies));
}

const sourceLabel = (source: TransitSource) => t(`pages.venues.transit.source.${source}`);

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

export function renderTransitView({ anchor, onBack }: { anchor: HTMLElement; onBack: () => void }): void {
  let selection: Selection | undefined;
  let hoveredVenueId: string | undefined;

  const root = el('div', 'tmx-transit');
  anchor.innerHTML = '';
  anchor.appendChild(root);

  const render = () => {
    const inputs = readInputs();
    root.innerHTML = '';
    root.appendChild(renderHeader(inputs, onBack));

    if (inputs.venues.length < 2) {
      root.appendChild(el('p', 'tmx-transit__empty', t('pages.venues.transit.needsTwoVenues')));
      return;
    }

    const body = el('div', 'tmx-transit__body');
    body.appendChild(renderNetwork(inputs));
    const side = el('div', 'tmx-transit__side');
    side.appendChild(renderMatrix(inputs));
    side.appendChild(renderEditor(inputs));
    body.appendChild(side);
    root.appendChild(body);
  };

  const select = (next: Selection) => {
    selection = next;
    render();
  };

  // ── header: what this is, the policy default, the legend ──────────────────
  function renderHeader(inputs: TransitInputs, back: () => void): HTMLElement {
    const header = el('div', 'tmx-transit__header');
    const backButton = el('button', 'tmx-transit__back', t('pages.venues.transit.back'));
    backButton.type = 'button';
    backButton.addEventListener('click', back);
    header.appendChild(backButton);

    const titles = el('div', 'tmx-transit__titles');
    titles.appendChild(el('h2', 'tmx-transit__title', t('pages.venues.transit.title')));
    titles.appendChild(el('p', 'tmx-transit__subtitle', t('pages.venues.transit.subtitle')));
    header.appendChild(titles);

    const policy =
      typeof inputs.defaultMinutes === 'number'
        ? t('pages.venues.transit.defaultFromPolicy', { minutes: formatMinutes(inputs.defaultMinutes) })
        : t('pages.venues.transit.noDefault');
    header.appendChild(el('div', 'tmx-transit__policy', policy));

    const legend = el('ul', 'tmx-transit__legend');
    for (const source of ['stated', 'sanctioned', 'default', 'facility'] as TransitSource[]) {
      const item = el('li', `tmx-transit__legend-item tmx-transit__legend-item--${source}`);
      item.appendChild(el('span', 'tmx-transit__swatch'));
      item.appendChild(el('span', undefined, sourceLabel(source)));
      legend.appendChild(item);
    }
    const oneWay = el('li', 'tmx-transit__legend-item tmx-transit__legend-item--one-way');
    oneWay.appendChild(el('span', 'tmx-transit__swatch'));
    oneWay.appendChild(el('span', undefined, t('pages.venues.transit.legendOneWay')));
    legend.appendChild(oneWay);
    header.appendChild(legend);
    return header;
  }

  // ── network ───────────────────────────────────────────────────────────────
  function renderNetwork(inputs: TransitInputs): HTMLElement {
    const panel = el('div', 'tmx-transit__network');
    const positions = layoutVenues(inputs.venues, NETWORK_WIDTH, NETWORK_HEIGHT);
    const canvas = svg('svg', {
      viewBox: `0 0 ${NETWORK_WIDTH} ${NETWORK_HEIGHT}`,
      role: 'img',
      'aria-label': t('pages.venues.transit.networkLabel'),
    });

    const defs = svg('defs');
    const marker = svg('marker', {
      id: 'tmx-transit-arrow',
      viewBox: '0 0 10 10',
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: 'auto-start-reverse',
    });
    marker.appendChild(svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'tmx-transit__arrowhead' }));
    defs.appendChild(marker);
    canvas.appendChild(defs);

    const edgeLayer = svg('g', { class: 'tmx-transit__edges' });
    const nodeLayer = svg('g', { class: 'tmx-transit__nodes' });
    for (const edge of transitEdges(inputs)) drawEdge(edgeLayer, edge, positions);
    for (const venue of inputs.venues) {
      const { x, y } = positions[venue.venueId];
      const node = svg('g', { class: 'tmx-transit__node', transform: `translate(${x} ${y})` });
      node.dataset.venueId = venue.venueId;
      if (venue.venueId === hoveredVenueId) node.classList.add('is-hovered');
      node.appendChild(svg('circle', { r: NODE_RADIUS }));
      const initials = svg('text', { class: 'tmx-transit__node-initials', 'text-anchor': 'middle', dy: '0.35em' });
      initials.textContent = (venue.abbreviation || venue.name).slice(0, 4);
      node.appendChild(initials);
      const label = svg('text', { class: 'tmx-transit__node-label', 'text-anchor': 'middle', y: NODE_RADIUS + 16 });
      label.textContent = venue.name;
      node.appendChild(label);
      const title = svg('title');
      title.textContent = venue.name;
      node.appendChild(title);
      node.addEventListener('mouseenter', () => highlight(canvas, venue.venueId));
      node.addEventListener('mouseleave', () => highlight(canvas, undefined));
      nodeLayer.appendChild(node);
    }
    canvas.appendChild(edgeLayer);
    canvas.appendChild(nodeLayer);
    panel.appendChild(canvas);
    return panel;
  }

  function highlight(canvas: SVGSVGElement, venueId?: string) {
    hoveredVenueId = venueId;
    canvas.classList.toggle('has-hover', !!venueId);
    canvas.querySelectorAll<SVGGElement>('.tmx-transit__edge').forEach((group) => {
      const touches = !!venueId && (group.dataset.from === venueId || group.dataset.to === venueId);
      group.classList.toggle('is-related', touches);
    });
  }

  function drawEdge(layer: SVGGElement, edge: TransitEdge, positions: Record<string, Point>) {
    const a = positions[edge.from];
    const b = positions[edge.to];
    if (edge.symmetric) {
      drawDirection(layer, edge.from, edge.to, edge.forward, a, b, 0, false);
    } else {
      drawDirection(layer, edge.from, edge.to, edge.forward, a, b, 18, true);
      drawDirection(layer, edge.to, edge.from, edge.back, b, a, 18, true);
    }
  }

  /** one direction (or a symmetric pair): a curve bent `bend` px to its left, an arrow when directional, a label */
  function drawDirection(
    layer: SVGGElement,
    from: string,
    to: string,
    transit: DirectedTransit,
    a: Point,
    b: Point,
    bend: number,
    directional: boolean,
  ) {
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const [ux, uy] = [(b.x - a.x) / length, (b.y - a.y) / length];
    const start = { x: a.x + ux * NODE_RADIUS, y: a.y + uy * NODE_RADIUS };
    const end = { x: b.x - ux * (NODE_RADIUS + 3), y: b.y - uy * (NODE_RADIUS + 3) };
    const control = { x: (a.x + b.x) / 2 - uy * bend * 2, y: (a.y + b.y) / 2 + ux * bend * 2 };
    const labelAt = { x: (a.x + b.x) / 2 - uy * bend, y: (a.y + b.y) / 2 + ux * bend };

    const group = svg('g', {
      class: `tmx-transit__edge tmx-transit__edge--${transit.source}`,
      tabindex: 0,
      role: 'button',
    });
    group.dataset.from = from;
    group.dataset.to = to;
    if (selection && selection.from === from && selection.to === to) group.classList.add(SELECTED);
    if (selection && !directional && selection.from === to && selection.to === from) group.classList.add(SELECTED);

    const path = svg('path', {
      d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
      class: 'tmx-transit__edge-line',
      ...(directional ? { 'marker-end': 'url(#tmx-transit-arrow)' } : {}),
    });
    group.appendChild(path);
    // a wide transparent stroke: the edge is easy to hit
    group.appendChild(
      svg('path', {
        d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
        class: 'tmx-transit__edge-hit',
      }),
    );

    const text = transit.source === 'facility' ? t('pages.venues.transit.sameSite') : formatMinutes(transit.minutes);
    const pill = svg('g', { class: 'tmx-transit__pill', transform: `translate(${labelAt.x} ${labelAt.y})` });
    const width = 14 + text.length * 7 + (transit.source === 'sanctioned' ? 12 : 0);
    pill.appendChild(svg('rect', { x: -width / 2, y: -11, width, height: 22, rx: 11 }));
    const label = svg('text', { 'text-anchor': 'middle', dy: '0.35em', x: transit.source === 'sanctioned' ? 5 : 0 });
    label.textContent = text;
    pill.appendChild(label);
    if (transit.source === 'sanctioned') {
      // a small padlock: a sanctioning body set this value, a floor for any edit
      const lock = svg('g', { class: 'tmx-transit__lock', transform: `translate(${-width / 2 + 9} -4)` });
      lock.appendChild(svg('rect', { x: -4, y: 0, width: 8, height: 7, rx: 1.5 }));
      lock.appendChild(svg('path', { d: 'M -2.5 0 V -2 a 2.5 2.5 0 0 1 5 0 V 0', fill: 'none' }));
      pill.appendChild(lock);
    }
    group.appendChild(pill);

    const title = svg('title');
    title.textContent = `${sourceLabel(transit.source)}: ${formatMinutes(transit.minutes)}`;
    group.appendChild(title);

    const choose = () => select({ from, to });
    group.addEventListener('click', choose);
    group.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose();
      }
    });
    layer.appendChild(group);
  }

  // ── matrix ────────────────────────────────────────────────────────────────
  function renderMatrix(inputs: TransitInputs): HTMLElement {
    const wrapper = el('div', 'tmx-transit__matrix');
    const table = el('table');
    const caption = el('caption', undefined, t('pages.venues.transit.matrixCaption'));
    table.appendChild(caption);

    const head = el('thead');
    const headRow = el('tr');
    headRow.appendChild(el('th', 'tmx-transit__corner', t('pages.venues.transit.fromTo')));
    for (const venue of inputs.venues) {
      const th = el('th', undefined, venue.abbreviation || venue.name);
      th.title = venue.name;
      th.scope = 'col';
      headRow.appendChild(th);
    }
    head.appendChild(headRow);
    table.appendChild(head);

    const bodyRows = el('tbody');
    for (const from of inputs.venues) {
      const row = el('tr');
      const rowHead = el('th', undefined, from.abbreviation || from.name);
      rowHead.title = from.name;
      rowHead.scope = 'row';
      row.appendChild(rowHead);
      for (const to of inputs.venues) {
        if (from.venueId === to.venueId) {
          row.appendChild(el('td', 'tmx-transit__cell tmx-transit__cell--self', '—'));
          continue;
        }
        const transit = directedTransit(inputs, from.venueId, to.venueId);
        const cell = el(
          'td',
          `tmx-transit__cell tmx-transit__cell--${transit.source}`,
          transit.source === 'facility' ? t('pages.venues.transit.sameSite') : formatMinutes(transit.minutes),
        );
        cell.tabIndex = 0;
        cell.title = `${from.name} → ${to.name}: ${sourceLabel(transit.source)}`;
        cell.dataset.from = from.venueId;
        cell.dataset.to = to.venueId;
        if (selection && selection.from === from.venueId && selection.to === to.venueId) cell.classList.add(SELECTED);
        const choose = () => select({ from: from.venueId, to: to.venueId });
        cell.addEventListener('click', choose);
        cell.addEventListener('keydown', (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            choose();
          }
        });
        row.appendChild(cell);
      }
      bodyRows.appendChild(row);
    }
    table.appendChild(bodyRows);
    wrapper.appendChild(table);
    return wrapper;
  }

  // ── editor ────────────────────────────────────────────────────────────────
  function renderEditor(inputs: TransitInputs): HTMLElement {
    const panel = el('div', 'tmx-transit__editor');
    if (!selection) {
      panel.appendChild(el('p', 'tmx-transit__hint', t('pages.venues.transit.selectHint')));
      return panel;
    }
    const { from, to } = selection;
    const nameOf = (venueId: string) => inputs.venues.find((venue) => venue.venueId === venueId)?.name ?? venueId;
    const transit = directedTransit(inputs, from, to);
    const entry = transit.entry;
    const sanctionedMinutes = entry?.sanctioned?.minutes;

    panel.appendChild(
      el(
        'h3',
        'tmx-transit__editor-title',
        t('pages.venues.transit.editTitle', { from: nameOf(from), to: nameOf(to) }),
      ),
    );
    panel.appendChild(
      el(
        'p',
        'tmx-transit__editor-now',
        t('pages.venues.transit.currently', {
          minutes: formatMinutes(transit.minutes),
          source: sourceLabel(transit.source),
        }),
      ),
    );
    if (typeof sanctionedMinutes === 'number') {
      panel.appendChild(
        el(
          'p',
          'tmx-transit__editor-sanctioned',
          t('pages.venues.transit.sanctionedFloor', { minutes: formatMinutes(sanctionedMinutes) }),
        ),
      );
    }

    const form = el('form', 'tmx-transit__form');
    const minutesLabel = el('label', 'tmx-transit__field');
    minutesLabel.appendChild(el('span', undefined, t('pages.venues.transit.minutes')));
    const minutesInput = el('input');
    minutesInput.type = 'number';
    minutesInput.min = String(sanctionedMinutes ?? 0);
    minutesInput.step = '1';
    minutesInput.inputMode = 'numeric';
    minutesInput.value = String(entry?.minutes ?? transit.minutes);
    minutesLabel.appendChild(minutesInput);
    form.appendChild(minutesLabel);

    const oneWayLabel = el('label', 'tmx-transit__check');
    const oneWayInput = el('input');
    oneWayInput.type = 'checkbox';
    oneWayInput.checked = !!entry?.oneWay;
    oneWayLabel.appendChild(oneWayInput);
    oneWayLabel.appendChild(
      el('span', undefined, t('pages.venues.transit.oneWay', { from: nameOf(from), to: nameOf(to) })),
    );
    form.appendChild(oneWayLabel);

    const message = el('p', 'tmx-transit__message');
    message.setAttribute('role', 'status');

    const actions = el('div', 'tmx-transit__actions');
    const save = el('button', 'tmx-transit__save', t('pages.venues.transit.save'));
    save.type = 'submit';
    actions.appendChild(save);
    if (entry && !entry.sanctioned) {
      const remove = el('button', 'tmx-transit__remove', t('pages.venues.transit.remove'));
      remove.type = 'button';
      remove.addEventListener('click', () => {
        const venueIds = entry.oneWay ? entry.venueIds : [from, to];
        mutationRequest({
          methods: [{ method: REMOVE_VENUE_TRANSIT, params: { venueIds, oneWay: !!entry.oneWay } }],
          callback: (result: any) => {
            if (result?.success) render();
            else refused(result);
          },
        });
      });
      actions.appendChild(remove);
    }
    const cancel = el('button', 'tmx-transit__cancel', t('pages.venues.transit.cancel'));
    cancel.type = 'button';
    cancel.addEventListener('click', () => {
      selection = undefined;
      render();
    });
    actions.appendChild(cancel);
    form.appendChild(actions);
    form.appendChild(message);

    const refused = (result: any) => {
      const floor = result?.error?.context?.sanctionedMinutes ?? result?.context?.sanctionedMinutes;
      const text =
        typeof floor === 'number'
          ? t('pages.venues.transit.errors.belowSanctioned', { minutes: formatMinutes(floor) })
          : result?.error?.message || t('common.error');
      message.textContent = text;
      tmxToast({ intent: 'is-warning', message: text });
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const validation = validateTransitMinutes(minutesInput.value, sanctionedMinutes);
      if (validation.error) {
        message.textContent =
          validation.error === 'belowSanctioned'
            ? t('pages.venues.transit.errors.belowSanctioned', { minutes: formatMinutes(sanctionedMinutes ?? 0) })
            : t('pages.venues.transit.errors.notWhole');
        return;
      }
      const oneWay = oneWayInput.checked;
      mutationRequest({
        methods: [
          {
            method: SET_VENUE_TRANSIT,
            params: { venueIds: [from, to], minutes: validation.minutes, ...(oneWay ? { oneWay } : {}) },
          },
        ],
        callback: (result: any) => {
          if (result?.success) render();
          else refused(result);
        },
      });
    });

    panel.appendChild(form);
    queueMicrotask(() => minutesInput.focus());
    return panel;
  }

  render();
}

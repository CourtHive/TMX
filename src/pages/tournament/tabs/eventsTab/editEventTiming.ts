/**
 * The event's Match timing modal, launched from the event drawer in edit mode.
 *
 * One row per format the event uses (and any format it already times), each with its average and recovery minutes
 * and whether they are the scheduling policy's or the event's own. The director can add a format before it is in
 * use, through the same scoring-format picker the draw editors use; it opens at the policy's timing for it.
 * Saving sends one `modifyEventMatchUpFormatTiming` per changed row in a single request; "Use the defaults" sends
 * `removeEventMatchUpFormatTiming`. The rows and methods come from `eventTimingRows`; this module only renders.
 */
import { addedTimingRow, buildTimingMethods, buildUseDefaultsMethod, eventTimingRows } from './eventTimingRows';
import { confirmModal, openModal } from 'components/modals/baseModal/baseModal';
import { getMatchFormatLabels } from 'components/modals/matchFormatLabels';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getMatchUpFormatModal } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

// constants and types
import { EVENT_TIMING_ADD_FORMAT, EVENT_TIMING_SAVE, EVENT_TIMING_USE_DEFAULTS } from 'constants/tmxConstants';
import type { EventTimingRow, FormatUse, TimingEdit } from './eventTimingRows';

const KEY = 'pages.events.editEvent.timing';

function describeUses(uses: FormatUse[]): string {
  if (!uses.length) return t(`${KEY}.useAdded`);
  return uses
    .map((use) => {
      if (use.kind === 'event') return t(`${KEY}.useEvent`);
      if (use.kind === 'draw') return t(`${KEY}.useDraw`, { name: use.name });
      return t(`${KEY}.useCollection`, { name: use.name });
    })
    .join(' · ');
}

function minutesInput(value: number | string | undefined, label: string, onInput: (value: string) => void) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.className = 'input tmx-event-timing-input';
  input.value = value === undefined ? '' : String(value);
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

function headerCell(text: string): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'tmx-event-timing-head';
  cell.textContent = text;
  return cell;
}

export function editEventTiming({ eventId, onSave }: { eventId: string; onSave?: () => void }): void {
  const rows: EventTimingRow[] = eventTimingRows({ eventId });
  const edits: Record<string, TimingEdit> = {};
  const container = document.createElement('div');
  container.className = 'tmx-event-timing';

  const intro = document.createElement('p');
  intro.className = 'tmx-event-timing-intro';
  intro.textContent = t(`${KEY}.intro`);

  const table = document.createElement('div');
  table.className = 'tmx-event-timing-table';
  table.setAttribute('role', 'table');

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.id = EVENT_TIMING_ADD_FORMAT;
  addButton.className = 'button is-small tmx-event-timing-add';
  addButton.textContent = t(`${KEY}.addFormat`);

  const renderRow = (row: EventTimingRow) => {
    const edit = (edits[row.matchUpFormat] ??= {
      averageMinutes: row.averageMinutes,
      recoveryMinutes: row.recoveryMinutes,
    });
    const line = document.createElement('div');
    line.className = 'tmx-event-timing-row';
    line.setAttribute('role', 'row');
    line.dataset.matchUpFormat = row.matchUpFormat;

    const format = document.createElement('div');
    format.className = 'tmx-event-timing-format';
    const code = document.createElement('code');
    code.textContent = row.matchUpFormat;
    const uses = document.createElement('div');
    uses.className = 'tmx-event-timing-uses';
    uses.textContent = describeUses(row.uses);
    format.append(code, uses);

    const average = minutesInput(edit.averageMinutes, t(`${KEY}.average`), (value) => {
      edit.averageMinutes = value;
    });
    average.dataset.field = 'averageMinutes';
    const recovery = minutesInput(edit.recoveryMinutes, t(`${KEY}.recovery`), (value) => {
      edit.recoveryMinutes = value;
    });
    recovery.dataset.field = 'recoveryMinutes';

    const badge = document.createElement('span');
    badge.className = `tmx-event-timing-badge${row.override ? ' own' : ''}`;
    badge.dataset.source = row.override ? 'event' : 'policy';
    badge.textContent = row.override ? t(`${KEY}.own`) : t(`${KEY}.policy`);

    line.append(format, average, recovery, badge);
    return line;
  };

  const render = () => {
    const children: HTMLElement[] = [
      headerCell(t(`${KEY}.format`)),
      headerCell(t(`${KEY}.average`)),
      headerCell(t(`${KEY}.recovery`)),
      headerCell(t(`${KEY}.source`)),
    ];
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'tmx-event-timing-empty';
      empty.textContent = t(`${KEY}.noFormats`);
      children.push(empty);
    }
    children.push(...rows.map(renderRow));
    table.replaceChildren(...children);
  };

  addButton.addEventListener('click', () => {
    getMatchUpFormatModal({
      callback: (matchUpFormat: string) => {
        if (!matchUpFormat) return;
        const { row, refusal } = addedTimingRow({ eventId, matchUpFormat, rows });
        if (refusal || !row) {
          tmxToast({ message: t(`${KEY}.refusal.${refusal}`), intent: 'is-warning' });
          return;
        }
        rows.push(row);
        render();
      },
      config: { labels: getMatchFormatLabels() },
    } as any);
  });

  render();
  container.append(intro, table, addButton);

  let modal: any;

  const save = () => {
    const { methods, refusal } = buildTimingMethods({ eventId, rows, edits });
    if (refusal) {
      tmxToast({ message: t(`${KEY}.refusal.${refusal}`), intent: 'is-danger' });
      return;
    }
    modal?.close();
    if (!methods.length) {
      tmxToast({ message: t(`${KEY}.noChanges`) });
      return;
    }
    mutationRequest({
      methods,
      callback: (result: any) => {
        if (!result?.success) {
          tmxToast({ message: result?.error?.message || t('common.error'), intent: 'is-danger' });
          return;
        }
        tmxToast({ message: t(`${KEY}.saved`), intent: 'is-success' });
        onSave?.();
      },
    });
  };

  const useDefaults = () =>
    confirmModal({
      title: t(`${KEY}.useDefaults`),
      query: t(`${KEY}.useDefaultsConfirm`),
      okAction: () => {
        modal?.close();
        mutationRequest({
          methods: [buildUseDefaultsMethod(eventId)],
          callback: (result: any) => {
            if (result?.success) onSave?.();
          },
        });
      },
    });

  modal = openModal({
    title: t(`${KEY}.title`),
    content: container,
    config: { padding: '.5', content: { padding: '1' }, maxWidth: 600 },
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      {
        hide: !rows.some((row) => row.override),
        id: EVENT_TIMING_USE_DEFAULTS,
        label: t(`${KEY}.useDefaults`),
        intent: 'is-warning',
        onClick: useDefaults,
        close: false,
      },
      { id: EVENT_TIMING_SAVE, label: t('common.save'), intent: 'is-info', onClick: save, close: false },
    ] as any,
  });
}

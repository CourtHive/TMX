import { validators, renderButtons, renderForm, controlBar } from 'courthive-components';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { nextCourtNames, summariseCourtNames } from './courtNaming';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { tournamentEngine } from 'services/factory/engine';
import { getCourtColumns } from './getCourtColumns';
import { tools } from 'tods-competition-factory';
import { context } from 'services/context';
import { t } from 'i18n';

// constants
import { ADD_COURTS, DELETE_COURTS, MODIFY_COURT } from 'constants/mutationConstants';
import { NONE, OVERLAY, RIGHT, SUB_TABLE } from 'constants/tmxConstants';

const COURTS_PREVIEW_ID = 'addCourtsPreview';

function addCourtsToVenue(venueId: string, courtsTable: any): void {
  const numberValidator = (value: string) => value && !Number.isNaN(Number(value)) && Number(value) > 0;

  const plannedNames = (count: number) =>
    nextCourtNames({ courts: tournamentEngine.findVenue({ venueId })?.venue?.courts ?? [], count });

  // Naming is derived, not typed, so show what will actually be created. A duplicate "Court 1"
  // becomes visible before the mutation rather than after — which is how the original defect was
  // absorbed as a manual rename instead of being reported.
  const updatePreview = (count: number) => {
    const preview = document.getElementById(COURTS_PREVIEW_ID);
    if (!preview) return;
    const names = count > 0 ? plannedNames(count) : [];
    preview.textContent = names.length ? t('pages.venues.addCourtsPreview', { names: summariseCourtNames(names) }) : '';
  };

  const enableSubmit = ({ inputs }: any) => {
    const value = inputs['courtsCount']?.value;
    const isValid = !!numberValidator(value);
    const btn = document.getElementById('addCourtsButton');
    if (btn) (btn as HTMLButtonElement).disabled = !isValid;
    updatePreview(isValid ? Number.parseInt(value) : 0);
  };

  const content = (elem: HTMLElement) => {
    // The drawer stores this return value as `attributes.content`, which `saveCourts` reads for the
    // court count — returning anything else (or nothing) silently disables the Add button's effect.
    const inputs = renderForm(
      elem,
      [
        {
          error: t('pages.venues.addVenue.numberOfCourtsError'),
          validator: validators.numericValidator,
          label: t('pages.venues.addVenue.numberOfCourts'),
          field: 'courtsCount',
          value: '1',
          focus: true,
        },
      ],
      [{ control: 'courtsCount', onInput: enableSubmit }],
    );

    const preview = document.createElement('div');
    preview.id = COURTS_PREVIEW_ID;
    preview.className = 'courts-preview';
    elem.appendChild(preview);
    updatePreview(1);

    return inputs;
  };

  const saveCourts = () => {
    const courtsCount = Number.parseInt(context.drawer.attributes.content?.courtsCount?.value);
    if (!courtsCount || courtsCount < 1) return;

    const { venue } = tournamentEngine.findVenue({ venueId });
    const existingCourts = venue?.courts || [];

    // Name the courts here rather than leaving it to the engine, which numbers from 1 on every call
    // and so hands a venue of "Court 1".."Court 15" a second "Court 1". `nextCourtNames` continues
    // the venue's own numbering.
    const courtNames = nextCourtNames({ courts: existingCourts, count: courtsCount });

    // Mint the courtIds here for the same reason — under server-first the client replays the
    // acknowledged mutation against its own factory instance, and an engine-generated UUID differs
    // between the two runs, leaving the browser holding courtIds the server has never seen. The next
    // modifyCourt/deleteCourts on one of them then fails ERR_NOT_FOUND_COURT. `addVenue.ts` has
    // always passed explicit courtIds; this path had not.
    const courtIds = Array.from({ length: courtsCount }, () => tools.UUID());
    const addCourtsParams: any = { courtsCount, venueId, courtIds, courtNames };

    const methods = [{ method: ADD_COURTS, params: addCourtsParams }];
    mutationRequest({
      methods,
      callback: (result: any) => {
        if (result?.success) {
          const { venue } = tournamentEngine.findVenue({ venueId });
          if (venue?.courts) courtsTable.replaceData(venue.courts);
        }
      },
    });
  };

  const footer = (elem: HTMLElement, close: () => void) =>
    renderButtons(
      elem,
      [
        { label: t('common.cancel'), close: true },
        { onClick: saveCourts, id: 'addCourtsButton', intent: 'is-info', label: t('add'), close: true },
      ],
      close,
    );

  context.drawer.open({
    title: `<b style='larger'>${t('pages.venues.addCourts')}</b>`,
    width: '300px',
    side: RIGHT,
    content,
    footer,
  });
}

export const venueRowFormatter =
  (setTable: (venueId: string, table: any) => void) =>
  (row: any): void => {
    const holderEl = document.createElement('div');
    const controlEl = document.createElement('div');
    controlEl.className = 'tableControl';
    controlEl.style.marginBottom = '1em';

    holderEl.appendChild(controlEl);

    const borderStyle = '1px solid var(--tmx-border-primary)';
    const tableEl = document.createElement('div');
    tableEl.style.backgroundColor = 'var(--tmx-bg-primary)';
    tableEl.style.border = borderStyle;
    tableEl.style.width = '99%';

    holderEl.className = SUB_TABLE;
    holderEl.style.display = NONE;
    holderEl.style.boxSizing = 'border-box';
    holderEl.style.paddingLeft = '10px';
    holderEl.style.borderTop = borderStyle;
    holderEl.style.borderBottom = borderStyle;

    holderEl.appendChild(tableEl);

    row.getElement().appendChild(holderEl);

    const columns = getCourtColumns();

    const courtsTable = new Tabulator(tableEl, {
      headerSortElement: headerSortElement([
        'courtName',
        'scheduledMinutes',
        'unscheduledMinutes',
        'floodlit',
        'surfaceType',
        'indoorOutdoor',
      ]),
      data: row.getData().courts,
      placeholder: 'No courts',
      layout: 'fitColumns',
      index: 'courtId',
      maxHeight: 400,
      columns,
    });

    const venueId = row.getData().venueId;
    setTable(venueId, courtsTable);

    const deleteCourts = () => {
      const courtIds = courtsTable.getSelectedData().map(({ courtId }: any) => courtId);
      const methods = [{ method: DELETE_COURTS, params: { courtIds, force: true } }];
      const callback = (result: any) => result.success && courtsTable.deleteRow(courtIds);
      mutationRequest({ methods, callback });
    };

    const items = [
      {
        label: 'Delete selected',
        onClick: deleteCourts,
        intent: 'is-danger',
        stateChange: true,
        location: OVERLAY,
      },
      {
        label: t('pages.venues.addCourts'),
        onClick: () => addCourtsToVenue(venueId, courtsTable),
        location: RIGHT,
        align: RIGHT,
      },
    ];

    controlBar({ table: courtsTable, target: controlEl, items });

    courtsTable.on('scrollVertical', destroyTipster);
    courtsTable.on('cellEdited', (cell: any) => {
      const row = cell.getRow().getData();
      const value = cell.getValue();

      if (value.length) {
        const postMutation = (result: any) => {
          if (!result.success) {
            console.log({ result });
          }
        };
        const methods = [
          { method: MODIFY_COURT, params: { courtId: row.courtId, modifications: { courtName: value } } },
        ];
        mutationRequest({ methods, callback: postMutation });
      } else {
        console.log('INVALID VALUE');
      }
    });
  };

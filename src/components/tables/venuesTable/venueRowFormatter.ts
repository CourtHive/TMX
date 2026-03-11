import { validators, renderButtons, renderForm, controlBar } from 'courthive-components';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { deriveCourtNameBase } from 'components/forms/venue';
import { tournamentEngine } from 'tods-competition-factory';
import { destroyTipster } from 'components/popovers/tipster';
import { getCourtColumns } from './getCourtColumns';
import { context } from 'services/context';
import { t } from 'i18n';

// constants
import { ADD_COURTS, DELETE_COURTS, MODIFY_COURT } from 'constants/mutationConstants';
import { NONE, OVERLAY, RIGHT, SUB_TABLE } from 'constants/tmxConstants';

function addCourtsToVenue(venueId: string, courtsTable: any): void {
  const numberValidator = (value: string) => value && !Number.isNaN(Number(value)) && Number(value) > 0;

  const enableSubmit = ({ inputs }: any) => {
    const isValid = !!numberValidator(inputs['courtsCount']?.value);
    const btn = document.getElementById('addCourtsButton');
    if (btn) (btn as HTMLButtonElement).disabled = !isValid;
  };

  const content = (elem: HTMLElement) =>
    renderForm(
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

  const saveCourts = () => {
    const courtsCount = Number.parseInt(context.drawer.attributes.content?.courtsCount?.value);
    if (!courtsCount || courtsCount < 1) return;

    // Derive court name root from existing courts, fall back to venue abbreviation
    const { venue } = tournamentEngine.findVenue({ venueId });
    const existingCourts = venue?.courts || [];
    const courtNameRoot = deriveCourtNameBase(existingCourts);

    const addCourtsParams: any = { courtsCount, venueId };
    if (courtNameRoot) {
      addCourtsParams.courtNameRoot = courtNameRoot;
    } else {
      addCourtsParams.venueAbbreviationRoot = true;
    }

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

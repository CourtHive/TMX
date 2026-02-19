/**
 * Edit court drawer with form validation.
 * Modifies court name, inOut, and surface via mutation.
 */
import { validators, renderButtons, renderForm } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { factoryConstants } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { t } from 'i18n';

import { MODIFY_COURT } from 'constants/mutationConstants';
import { RIGHT } from 'constants/tmxConstants';

const { surfaceConstants } = factoryConstants;
const EMPTY_OPTION = '------------';

export function editCourt({ court, callback }: { court?: any; callback?: (result: any) => void } = {}): void {
  const values: any = {
    courtName: court?.courtName || '',
    indoorOutdoor: court?.indoorOutdoor || '',
    surfaceType: court?.surfaceType || '',
  };

  const valueChange = () => {
    // Placeholder for future functionality
  };

  const enableSubmit = ({ inputs }: any) => {
    const isValid = !!validators.nameValidator(1)(inputs['courtName'].value);
    const saveButton = document.getElementById('saveCourtButton');
    if (saveButton) (saveButton as HTMLButtonElement).disabled = !isValid;
  };

  const relationships = [
    {
      control: 'courtName',
      onInput: enableSubmit,
    },
  ];

  // Build surface options from factory constants
  const surfaceOptions = (Object.values(surfaceConstants) as string[]).map((surface: string) => ({
    value: surface,
    label: surface.charAt(0) + surface.slice(1).toLowerCase(),
    selected: values.surfaceType === surface,
  }));

  // Add empty option at the beginning
  surfaceOptions.unshift({
    value: '',
    label: EMPTY_OPTION,
    selected: !values.surfaceType,
  });

  const content = (elem: HTMLElement) =>
    renderForm(
      elem,
      [
        {
          error: t('pages.venues.editCourt.courtNameError'),
          validator: validators.nameValidator(1),
          placeholder: t('pages.venues.editCourt.courtNamePlaceholder'),
          value: values.courtName,
          onChange: valueChange,
          selectOnFocus: true,
          label: t('pages.venues.editCourt.courtNameLabel'),
          field: 'courtName',
          focus: true,
        },
        {
          label: t('pages.venues.editCourt.inOutLabel'),
          field: 'indoorOutdoor',
          value: values.indoorOutdoor,
          onChange: valueChange,
          options: [
            { value: '', label: EMPTY_OPTION, selected: !values.indoorOutdoor },
            { value: 'INDOOR', label: t('indoors'), selected: values.indoorOutdoor === 'INDOOR' },
            { value: 'OUTDOOR', label: t('outdoors'), selected: values.indoorOutdoor === 'OUTDOOR' },
          ],
        },
        {
          label: t('pages.venues.editCourt.surfaceLabel'),
          field: 'surfaceType',
          value: values.surfaceType,
          onChange: valueChange,
          options: surfaceOptions,
        },
      ],
      relationships,
    );

  const saveCourt = () => {
    const courtName = context.drawer.attributes.content.courtName.value;
    const indoorOutdoor = context.drawer.attributes.content.indoorOutdoor.value;
    const surfaceType = context.drawer.attributes.content.surfaceType.value;

    // Validation
    if (!courtName || courtName.length < 1) {
      tmxToast({ message: t('pages.venues.editCourt.courtNameRequired'), intent: 'is-danger' });
      return;
    }

    const courtUpdates: any = { courtName };

    // Handle indoorOutdoor: set to value if selected, undefined if cleared
    if (indoorOutdoor && indoorOutdoor !== EMPTY_OPTION && indoorOutdoor !== '') {
      courtUpdates.indoorOutdoor = indoorOutdoor;
    } else {
      courtUpdates.indoorOutdoor = undefined;
    }

    // Handle surfaceType: set to value if selected, undefined if cleared
    if (surfaceType && surfaceType !== EMPTY_OPTION && surfaceType !== '') {
      courtUpdates.surfaceType = surfaceType;
    } else {
      courtUpdates.surfaceType = undefined;
    }

    const postMutation = (result: any) => {
      if (result.success) {
        if (isFunction(callback)) callback({ ...result, courtUpdates });
      } else if (result.error) {
        tmxToast({ intent: 'is-warning', message: result.error?.message || t('common.error') });
        if (isFunction(callback)) callback(result);
      }
    };

    const courtId = court.courtId;
    const methods = [{ method: MODIFY_COURT, params: { courtId, modifications: courtUpdates } }];
    mutationRequest({ methods, callback: postMutation });
  };

  const isValidForSave = () => {
    const courtName = context.drawer.attributes.content.courtName.value;
    return courtName && courtName.length >= 1;
  };

  const footer = (elem: HTMLElement, close: () => void) =>
    renderButtons(
      elem,
      [
        { label: t('common.cancel'), close: true },
        {
          onClick: saveCourt,
          id: 'saveCourtButton',
          intent: 'is-info',
          disabled: !isValidForSave(),
          label: t('common.save'),
          close: true,
        },
      ],
      close,
    );

  context.drawer.open({
    title: `<b style='larger'>${t('pages.venues.editCourt.title')}</b>`,
    width: '300px',
    side: RIGHT,
    content,
    footer,
  });
}

/**
 * Edit venue drawer with form validation.
 * Modifies venue name and abbreviation via mutation.
 */
import { validators, renderButtons, renderForm } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { MODIFY_VENUE } from 'constants/mutationConstants';
import { RIGHT } from 'constants/tmxConstants';

export function editVenue({
  venue,
  callback,
}: { venue?: any; callback?: (result: any) => void } = {}): void {
  const values: any = {
    venueName: venue?.venueName || '',
    venueAbbreviation: venue?.venueAbbreviation || '',
    updateCourtNames: false,
  };

  // Get current venue details including courts
  const { venue: venueDetails } = tournamentEngine.findVenue({ venueId: venue.venueId });
  const courts = venueDetails?.courts || [];

  const valueChange = () => {
    // Placeholder for future functionality
  };

  const enableSubmit = ({ inputs }: any) => {
    const isValid = !!(
      validators.nameValidator(2, 6)(inputs['venueAbbreviation'].value) &&
      validators.nameValidator(5)(inputs['venueName'].value)
    );
    const saveButton = document.getElementById('saveVenueButton');
    if (saveButton) (saveButton as HTMLButtonElement).disabled = !isValid;
  };

  const relationships = [
    {
      control: 'venueAbbreviation',
      onInput: enableSubmit,
    },
    {
      control: 'venueName',
      onInput: enableSubmit,
    },
  ];

  const content = (elem: HTMLElement) =>
    renderForm(
      elem,
      [
        {
          error: 'minimum of 5 characters',
          validator: validators.nameValidator(5),
          placeholder: 'Venue name',
          value: values.venueName,
          onChange: valueChange,
          selectOnFocus: true,
          label: 'Venue name',
          field: 'venueName',
          focus: true,
        },
        {
          error: 'minimum of 2 characters, maximum of 6',
          validator: validators.nameValidator(2, 6),
          placeholder: 'Abbreviation',
          value: values.venueAbbreviation,
          onChange: valueChange,
          selectOnFocus: true,
          label: 'Abbreviation',
          field: 'venueAbbreviation',
        },
        {
          label: 'Update court names',
          field: 'updateCourtNames',
          id: 'updateCourtNames',
          checkbox: true,
          checked: values.updateCourtNames,
        },
      ],
      relationships,
    );

  const saveVenue = () => {
    const venueName = context.drawer.attributes.content.venueName.value;
    const venueAbbreviation = context.drawer.attributes.content.venueAbbreviation.value;
    const updateCourtNames = context.drawer.attributes.content.updateCourtNames.checked;

    // Validation
    if (!venueName || venueName.length < 5) {
      tmxToast({ message: 'Venue name must be at least 5 characters', intent: 'is-danger' });
      return;
    }

    if (!venueAbbreviation || venueAbbreviation.length < 2 || venueAbbreviation.length > 6) {
      tmxToast({ message: 'Abbreviation must be 2-6 characters', intent: 'is-danger' });
      return;
    }

    const venueUpdates: any = { venueName, venueAbbreviation };

    // Check if abbreviation changed and checkbox is selected
    const abbreviationChanged = venueAbbreviation !== venue.venueAbbreviation;
    if (updateCourtNames && abbreviationChanged && courts.length > 0) {
      // Build courts array with updated names based on new abbreviation
      venueUpdates.courts = courts.map((court: any, index: number) => ({
        courtId: court.courtId,
        courtName: `${venueAbbreviation} ${index + 1}`,
      }));
    }

    const courtsUpdated = updateCourtNames && abbreviationChanged && courts.length > 0;

    const postMutation = (result: any) => {
      if (result.success) {
        if (isFunction(callback)) callback({ ...result, venueUpdates, courtsUpdated });
      } else if (result.error) {
        tmxToast({ intent: 'is-warning', message: result.error?.message || 'Error' });
        if (isFunction(callback)) callback(result);
      }
    };

    const venueId = venue.venueId;
    const methods = [{ method: MODIFY_VENUE, params: { venueId, modifications: venueUpdates } }];
    mutationRequest({ methods, callback: postMutation });
  };

  const isValidForSave = () => {
    const venueName = context.drawer.attributes.content.venueName.value;
    const venueAbbreviation = context.drawer.attributes.content.venueAbbreviation.value;
    return (
      venueName &&
      venueName.length >= 5 &&
      venueAbbreviation &&
      venueAbbreviation.length >= 2 &&
      venueAbbreviation.length <= 6
    );
  };

  const footer = (elem: HTMLElement, close: () => void) =>
    renderButtons(
      elem,
      [
        { label: 'Cancel', close: true },
        {
          onClick: saveVenue,
          id: 'saveVenueButton',
          intent: 'is-info',
          disabled: !isValidForSave(),
          label: 'Save',
          close: true,
        },
      ],
      close,
    );

  context.drawer.open({
    title: `<b style='larger'>Edit venue</b>`,
    width: '300px',
    side: RIGHT,
    content,
    footer,
  });
}

import { incomingParticipants } from 'services/data/incomingParticipants';
import PublicGoogleSheetsParser from 'public-google-sheets-parser';
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { lang } from 'services/translator';

import { REGISTRATION } from 'constants/tmxConstants';

export function editRegistrationLink({ callback }) {
  const { extension } = tournamentEngine.findExtension({ discover: true, name: REGISTRATION });
  const existingLink = extension?.value;

  let inputs;
  const content = (elem) => {
    inputs = renderForm(elem, [
      {
        text: 'Pull participants from a Google Sheet which has a shared link'
      },
      {
        placeholder: 'URL of Google Sheet',
        value: existingLink,
        label: 'Sheet URL',
        field: 'url'
      }
    ]);
  };
  const submit = () => {
    const value = inputs.url.value;
    if (value) {
      const parts = value.split('/');
      const registered = parts.reduce((p, c) => (!p || c.length > p.length ? c : p), undefined);
      const newURL = !existingLink || (existingLink && registered !== existingLink);
      const validBits = existingLink || (parts.indexOf('docs.google.com') > 0 && parts.indexOf('spreadsheets') > 0);
      const sheetId = newURL ? registered : existingLink;
      if (!validBits) {
        const message = lang.tr('phrases.invalidsheeturl');
        tmxToast({ message, intent: 'is-danger' });
        inputs.url.value = '';
      } else if (validBits) {
        const parser = new PublicGoogleSheetsParser(sheetId);
        parser.parse().then((data) => incomingParticipants({ data, sheetId, callback }));
      } else {
        tmxToast({ message: 'URL unchanged', intent: 'is-info' });
      }
    }
  };
  const buttons = [
    { label: 'Cancel', intent: 'is-nothing' },
    { label: 'Submit', intent: 'is-primary', onClick: submit, close: true }
  ];
  openModal({ title: 'Import participants', buttons, content });
}

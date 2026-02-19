/**
 * Edit Google Sheets registration link modal.
 * Validates and imports participants from Google Sheets with shared link.
 */
import { incomingParticipants } from 'services/data/incomingParticipants';
import { fetchGoogleSheet } from 'services/sheets/fetchGoogleSheet';
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderForm } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

import { REGISTRATION } from 'constants/tmxConstants';

const instructions = `
  <b>Sharing Requirements</b>
  <ul>
    <li>Open your Google Sheet</li>
    <li>Click "Share" button (top right)</li>
    <li>Set to "Anyone with the link can view"</li>
    <li>Copy the shareable link</li>
  </ul>
  <br> 
  <b>Required Columns</b>
  <ul>
    <li><strong>First Name</strong> (or "first", "first_name")</li>
    <li><strong>Last Name</strong> (or "last", "last_name")</li>
  </ul>
  <br> 
  <b>Optional Columns</b>
  <ul>
    <li><strong>id</strong> or <strong>participantid</strong> - Unique identifier</li>
    <li><strong>Gender</strong> or <strong>sex</strong> - MALE, FEMALE, M, F, W, B, G</li>
    <li><strong>Birth Date</strong> - Format: YYYY-MM-DD</li>
    <li><strong>IOC</strong>, <strong>country</strong>, or <strong>nationality</strong> - 3-letter country code</li>
    <li><strong>City</strong> - City of residence</li>
    <li><strong>State</strong> - State/province</li>
    <li><strong>Tennis ID</strong> - Official tennis organization ID</li>
    <li><strong>UTR</strong> - Universal Tennis Rating (numeric)</li>
    <li><strong>WTN</strong> - World Tennis Number (numeric)</li>
    <li><strong>UTR Profile</strong> - Link to UTR profile page</li>
  </ul>
  <br> 
  <b>Column Name Flexibility</b>
  <ul>
    <li>Column names are case-insensitive</li>
    <li>Spaces and underscores are treated the same</li>
    <li>Partial matches work</li>
  </ul>`;

export function editRegistrationLink({ callback }: { callback?: () => void }): void {
  const { extension } = tournamentEngine.findExtension({ discover: true, name: REGISTRATION });
  const existingLink = extension?.value;

  let inputs: any;

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, [
      {
        text: t('pages.participants.sheetsLink.description'),
      },
      {
        placeholder: t('pages.participants.sheetsLink.urlPlaceholder'),
        value: existingLink,
        label: t('pages.participants.sheetsLink.urlLabel'),
        field: 'url',
      },
    ]);
  };

  const title = t('pages.participants.sheetsLink.title');
  const { update } = openModal({ title, buttons: [], content });

  const submit = () => {
    const value = inputs.url.value;
    if (value) {
      const parts = value.split('/');
      const registered = parts.reduce(
        (p: string | undefined, c: string) => (!p || c.length > p.length ? c : p),
        undefined,
      );
      const newURL = !existingLink || (existingLink && registered !== existingLink);
      const validBits = existingLink || (parts.indexOf('docs.google.com') > 0 && parts.indexOf('spreadsheets') > 0);
      const sheetId = newURL ? registered : existingLink;
      if (!validBits) {
        const message = t('phrases.invalidsheeturl');
        tmxToast({ message, intent: 'is-danger' });
        inputs.url.value = '';
      } else if (validBits) {
        fetchGoogleSheet({ sheetId }).then((data: any) => incomingParticipants({ data, sheetId, callback }));
      } else {
        tmxToast({ message: t('pages.participants.sheetsLink.urlUnchanged'), intent: 'is-info' });
      }
    }
  };
  const enterLink = () => {
    update({ buttons, content, title });
  };
  const getInfo = () => {
    update({
      buttons: [
        { label: t('common.close'), intent: 'is-nothing', close: true },
        { label: t('pages.participants.sheetsLink.enter'), intent: 'is-primary', onClick: enterLink, close: false },
      ],
      title: t('pages.participants.sheetsLink.instructionsTitle'),
      content: instructions,
    });
  };

  const buttons = [
    { label: t('common.cancel'), intent: 'is-nothing' },
    { label: t('pages.participants.sheetsLink.info'), intent: 'is-info', onClick: getInfo, close: false },
    { label: t('common.submit'), intent: 'is-primary', onClick: submit, close: true },
  ];
  update({ buttons });
}

/**
 * Edit Google Sheets registration link modal.
 * Validates and imports participants from Google Sheets with shared link.
 */
import { openImportParticipantsView } from 'components/modals/importParticipantsView';
import { fetchGoogleSheetRaw } from 'services/sheets/fetchGoogleSheet';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { renderForm } from 'courthive-components';
import { t } from 'i18n';

// constants and types
import { ADD_TOURNAMENT_EXTENSION } from 'constants/mutationConstants';
import { REGISTRATION } from 'constants/tmxConstants';

const IS_PRIMARY = 'is-primary';

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
    <li>You can correct any auto-detected mapping in the import view</li>
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
    if (!value) return;

    const parts = value.split('/');
    const registered = parts.reduce(
      (p: string | undefined, c: string) => (!p || c.length > p.length ? c : p),
      undefined,
    );
    const newURL = !existingLink || (existingLink && registered !== existingLink);
    const validBits = existingLink || (parts.indexOf('docs.google.com') > 0 && parts.indexOf('spreadsheets') > 0);
    const sheetId = newURL ? registered : existingLink;

    if (!validBits) {
      tmxToast({ message: t('phrases.invalidsheeturl'), intent: 'is-danger' });
      inputs.url.value = '';
      return;
    }

    fetchGoogleSheetRaw({ sheetId }).then(({ headers, rows }) => {
      if (!rows.length) {
        tmxToast({ message: t('toasts.noNewParticipants'), intent: IS_PRIMARY });
        if (callback) callback();
        return;
      }
      const additionalMethods = [
        {
          method: ADD_TOURNAMENT_EXTENSION,
          params: { extension: { name: REGISTRATION, value: sheetId } },
        },
      ];
      openImportParticipantsView({
        headers,
        rows,
        additionalMethods,
        callback: () => {
          if (callback) callback();
        },
      });
    });
  };

  const enterLink = () => {
    update({ buttons, content, title });
  };
  const getInfo = () => {
    update({
      buttons: [
        { label: t('common.close'), intent: 'none', close: true },
        { label: t('pages.participants.sheetsLink.enter'), intent: IS_PRIMARY, onClick: enterLink, close: false },
      ],
      title: t('pages.participants.sheetsLink.instructionsTitle'),
      content: instructions,
    });
  };

  const buttons = [
    { label: t('common.cancel'), intent: 'none' },
    { label: t('pages.participants.sheetsLink.info'), intent: 'is-info', onClick: getInfo, close: false },
    { label: t('common.submit'), intent: IS_PRIMARY, onClick: submit, close: true },
  ];
  update({ buttons });
}

import { renderMenu } from 'components/renderers/renderMenu';
import { tournamentEngine } from 'tods-competition-factory';
import { stringSort } from 'functions/sorting/sorting';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import { lang } from 'services/translator';
import { coms } from 'services/coms';

export function displayKeyActions() {
  const { tournamentInfo } = tournamentEngine.getTournamentInfo();
  const providerId = tournamentInfo?.organisation?.organisationId;

  tmx2db.findProvider(providerId || '').then((provider) => {
    let focusElement;
    const ctx = (elem, close) => {
      let items = (provider?.settings?.keys || [])
        .sort((a, b) => stringSort(a.description, b.description))
        .map((key) => ({
          text: key.description,
          onClick: () => submitKey(key.keyid)
        }));
      const menu = [
        {
          label: 'Enter new key',
          placeholder: lang.tr('phrases.submitkey'),
          id: 'keyEntryField',
          autoFocus: true,
          type: 'input',
          field: 'key',
          onKeyDown
        },
        { type: 'divider' },
        {
          text: 'Stored Keys',
          items
        }
      ];

      focusElement = renderMenu(elem, menu, close).focusElement;
    };
    context.drawer.open({
      title: lang.tr('keys'),
      width: '200px',
      content: ctx,
      callback: () => {
        if (focusElement) {
          setTimeout(() => {
            focusElement.focus();
          }, 500);
        }
      }
    });
  });

  function submitKey(keyid) {
    coms.sendKey(keyid.trim());
  }
  function onKeyDown(e) {
    if (e.key && e.key === 'Enter') {
      submitKey(e.target.value);
      context.drawer.close();
    }
  }
}

/**
 * Display key actions menu for provider keys.
 * Allows entry of new keys or selection from stored provider keys.
 */
import { renderMenu } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { stringSort } from 'functions/sorting/sorting';
import { emitTmx } from 'services/messaging/socketIo';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import { lang } from 'services/translator';

import { SEND_KEY } from 'constants/comsConstants';

export function displayKeyActions(): void {
  const { tournamentInfo } = tournamentEngine.getTournamentInfo();
  const providerId = tournamentInfo?.organisation?.organisationId;

  tmx2db.findProvider(providerId || '').then((provider: any) => {
    let focusElement: HTMLElement | undefined;
    const ctx = (elem: HTMLElement, close: () => void) => {
      const items = (provider?.settings?.keys || [])
        .sort((a: any, b: any) => stringSort(a.description, b.description))
        .map((key: any) => ({
          text: key.description,
          onClick: () => submitKey(key.keyid),
        }));
      const menu = [
        {
          label: 'Enter new key',
          placeholder: lang.tr('phrases.submitkey'),
          id: 'keyEntryField',
          type: 'input',
          focus: true,
          field: 'key',
          onKeyDown,
        },
        { type: 'divider' },
        {
          text: 'Stored Keys',
          items,
        },
      ];

      focusElement = (renderMenu as any)(elem, menu, close).focusElement;
    };
    context.drawer.open({
      title: lang.tr('keys'),
      width: '200px',
      content: ctx,
      callback: () => {
        if (focusElement) {
          setTimeout(() => {
            focusElement!.focus();
          }, 500);
        }
      },
    });
  });
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key && e.key === 'Enter') {
    submitKey((e.target as HTMLInputElement).value);
    context.drawer.close();
  }
}

function submitKey(keyid: string) {
  (emitTmx as any)({ data: { action: SEND_KEY, payload: { key: keyid.trim() } } });
}

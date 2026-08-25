/**
 * Print Player List Modal — generates PDF player list / sign-in sheet
 */
import { generatePlayerListPDF, generateSignInSheetPDF } from 'pdf-factory';
import { openPDF, savePDF } from 'services/pdf/export/pdfExport';
import { participantRoles } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { venueTimeZone } from 'functions/venueTimeFrame';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

const { COMPETITOR } = participantRoles;

interface PrintPlayerListParams {
  eventId?: string;
}

export function printPlayerList({ eventId }: PrintPlayerListParams = {}): void {
  const tournamentInfoResult = tournamentEngine.getTournamentInfo();
  const tournament = tournamentInfoResult?.tournamentInfo;
  // A *player* list. Without the role filter this swept officials, coaches, physios and volunteers onto
  // the printed player list and the sign-in sheet alongside the competitors.
  const { participants } = tournamentEngine.getParticipants({
    participantFilters: { participantTypes: ['INDIVIDUAL'], participantRoles: [COMPETITOR as any] },
  });

  // If eventId provided, filter to participants in that event
  let filteredParticipants = participants || [];
  let eventName = '';
  if (eventId) {
    const { event } = tournamentEngine.getEvent({ eventId });
    eventName = event?.eventName || '';
    const entryIds = new Set((event?.entries || []).map((e: any) => e.participantId));
    filteredParticipants = filteredParticipants.filter((p: any) => entryIds.has(p.participantId));
  }

  let printOptions = {
    format: 'playerList' as 'playerList' | 'signInSheet',
    eventName,
  };

  const formItems = [
    {
      field: 'format',
      label: 'Format',
      options: [
        { label: 'Player List', value: 'playerList', selected: true },
        { label: 'Sign-In Sheet', value: 'signInSheet' },
      ],
    },
    ...(eventId ? [{ text: `Event: ${eventName}`, style: 'font-weight: bold; margin-top: 8px;' }] : []),
    { text: `${filteredParticipants.length} participants`, style: 'color: #666; font-size: 13px;' },
  ];

  const content = document.createElement('div');
  content.style.padding = '1em';
  const inputs = renderForm(content, formItems);

  const buildPlayers = () =>
    filteredParticipants.map((p: any) => ({
      name: p.participantName,
      nationality: p.person?.nationalityCode || '',
      ranking: undefined,
      seedValue: undefined,
      entryStatus: p.entryStatus || '',
      events: [],
    }));

  const generate = (action: 'open' | 'download') => {
    const format = inputs.format?.value || 'playerList';
    const players = buildPlayers();
    const headerConfig = {
      tournamentName: tournament?.tournamentName || 'Tournament',
      startDate: tournament?.startDate,
    };

    let doc;
    if (format === 'signInSheet') {
      doc = generateSignInSheetPDF(players, {
        header: headerConfig,
        eventName: printOptions.eventName || undefined,
        // The day the sheet is signed AT THE VENUE — a sheet printed late
        // evening from a laptop west of the venue would otherwise be dated
        // tomorrow, on the one document whose date is its whole point.
        signInDate: new Date().toLocaleDateString(undefined, { timeZone: venueTimeZone() }),
      });
    } else {
      doc = generatePlayerListPDF(players, { header: headerConfig });
    }

    const filename = `${format === 'signInSheet' ? 'sign-in' : 'player-list'}.pdf`;
    if (action === 'open') {
      openPDF({ doc });
    } else {
      savePDF({ doc, filename });
    }
  };

  const buttons = [
    { label: t('common.cancel'), intent: 'none', close: true },
    {
      label: t('view'),
      intent: 'is-info',
      onClick: () => generate('open'),
      close: true,
    },
    {
      label: t('dl'),
      intent: 'is-primary',
      onClick: () => generate('download'),
      close: true,
    },
  ];

  openModal({
    title: 'Print Player List',
    content,
    buttons,
  });
}

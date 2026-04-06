/**
 * Tally Report Modal — Shows how round robin tiebreak rules were applied
 * to determine finishing positions within a group.
 */
import { policyConstants, tournamentEngine } from 'tods-competition-factory';
import { openModal } from 'components/modals/baseModal/baseModal';
import { t } from 'i18n';

import { NONE } from 'constants/tmxConstants';

const { POLICY_TYPE_ROUND_ROBIN_TALLY } = policyConstants;

/** Human-readable labels for tally attributes */
const ATTRIBUTE_LABELS: Record<string, string> = {
  matchUpsWon: 'Matches Won',
  matchUpsPct: 'Match Win %',
  setsPct: 'Set Win %',
  gamesPct: 'Game Win %',
  pointsPct: 'Point Win %',
  setsWon: 'Sets Won',
  gamesWon: 'Games Won',
  pointsWon: 'Points Won',
  tieMatchUpsWon: 'Tie Matches Won',
  tieMatchUpsPct: 'Tie Match Win %',
  tieSinglesWon: 'Tie Singles Won',
  tieDoublesWon: 'Tie Doubles Won',
  head2Head: 'Head-to-Head',
  allDefaults: 'Defaults (all)',
  defaults: 'Defaults',
  walkovers: 'Walkovers',
  retirements: 'Retirements',
  matchUpsLost: 'Matches Lost',
  setsLost: 'Sets Lost',
  gamesLost: 'Games Lost',
};

function getAttributeLabel(attribute: string): string {
  return ATTRIBUTE_LABELS[attribute] || attribute;
}

type TallyReportParams = {
  groupMatchUps: any[];
  groupName: string;
  eventId: string;
  drawId: string;
};

export function showTallyReportModal({ groupMatchUps, groupName, eventId, drawId }: TallyReportParams): void {
  // Get policy definitions for this draw
  const { policyDefinitions } = tournamentEngine.getPolicyDefinitions({
    policyTypes: [POLICY_TYPE_ROUND_ROBIN_TALLY],
    eventId,
    drawId,
  });

  // Run tally with report generation
  const result = tournamentEngine.tallyParticipantResults({
    policyDefinitions,
    matchUps: groupMatchUps,
    generateReport: true,
  });

  if (!result || result.error) return;

  const { report, order /* readableReport */ } = result;

  // Log the factory's plain-text report for comparison
  // console.log(`[TallyReport] ${groupName}:\n${readableReport}`);

  // Build participant name lookup from matchUps
  const participantNames: Record<string, string> = {};
  for (const matchUp of groupMatchUps) {
    for (const side of matchUp.sides ?? []) {
      if (side.participantId && side.participant) {
        participantNames[side.participantId] = side.participant.participantName;
      }
    }
  }

  const getName = (pid: string) => participantNames[pid] || pid;

  const content = (container: HTMLElement) => {
    container.style.cssText = 'font-size: 13px; line-height: 1.6; max-height: 60vh; overflow-y: auto;';

    if (!report?.length && !order?.length) {
      const note = document.createElement('div');
      note.style.cssText = 'padding: 1em; color: var(--tmx-text-muted);';
      note.textContent = t('modals.tallyReport.incomplete');
      container.appendChild(note);
      return;
    }

    // Render report steps
    if (report?.length) {
      for (let i = 0; i < report.length; i++) {
        const step = report[i];
        const stepEl = renderReportStep(step, i, getName);
        container.appendChild(stepEl);
      }
    }

    // Render final order
    if (order?.length) {
      const orderSection = document.createElement('div');
      orderSection.style.cssText =
        'margin-top: 12px; padding-top: 8px; border-top: 2px solid var(--tmx-border-primary, #ccc);';

      const orderTitle = document.createElement('div');
      orderTitle.style.cssText = 'font-weight: 600; margin-bottom: 6px;';
      orderTitle.textContent = t('modals.tallyReport.finalOrder');
      orderSection.appendChild(orderTitle);

      for (const entry of order) {
        const pos = entry.groupOrder ?? entry.provisionalOrder ?? '?';
        const resolved = entry.resolved;
        const row = document.createElement('div');
        row.style.cssText = `padding: 2px 0; ${resolved ? '' : 'color: var(--tmx-text-muted); font-style: italic;'}`;
        const unresolvedSuffix = resolved ? '' : ` (${t('modals.tallyReport.unresolved')})`;
        row.textContent = `${pos}. ${getName(entry.participantId)}${unresolvedSuffix}`;
        orderSection.appendChild(row);
      }

      container.appendChild(orderSection);
    }
  };

  const buttons = [{ label: t('common.close'), intent: NONE, close: true }];

  openModal({
    title: `${groupName} — ${t('modals.tallyReport.title')}`,
    content,
    buttons,
    config: { maxWidth: 500, padding: '0.75' },
  });
}

function renderReportStep(step: any, index: number, getName: (pid: string) => string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'margin-bottom: 8px; padding: 8px; background: var(--tmx-bg-secondary, #f8f8f8); border-radius: 4px;';

  if (step.excludedDirectives?.length) {
    const attrs = step.excludedDirectives.map((d: any) => getAttributeLabel(d.attribute)).join(', ');
    const note = document.createElement('div');
    note.style.cssText = 'color: var(--tmx-text-muted); font-size: 12px;';
    note.textContent = `Skipped: ${attrs} (participant limit exceeded)`;
    wrapper.appendChild(note);
    return wrapper;
  }

  // Step header
  const header = document.createElement('div');
  header.style.cssText = 'font-weight: 600; margin-bottom: 4px;';

  const participantsCount = step.groups
    ? Object.values(step.groups).flat(Infinity).length
    : (step.participantIds?.length ?? 0);

  const isInitialGrouping = index === 0;
  const label = getAttributeLabel(step.attribute);

  if (isInitialGrouping) {
    header.textContent = `${t('modals.tallyReport.groupedBy')}: ${label}`;
  } else {
    const action = step.groups ? t('modals.tallyReport.separated') : t('modals.tallyReport.compared');
    header.textContent = `${t('modals.tallyReport.step')} ${index}: ${participantsCount} ${t('modals.tallyReport.participants')} ${action} ${t('modals.tallyReport.by')} ${label}`;
  }
  wrapper.appendChild(header);

  // Annotations
  if (step.idsFilter) {
    const note = document.createElement('div');
    note.style.cssText = 'font-size: 12px; color: var(--tmx-text-muted); font-style: italic; margin-bottom: 4px;';
    note.textContent = t('modals.tallyReport.idsFilterNote');
    wrapper.appendChild(note);
  }
  if (step.reversed) {
    const note = document.createElement('div');
    note.style.cssText = 'font-size: 12px; color: var(--tmx-text-muted); font-style: italic; margin-bottom: 4px;';
    note.textContent = t('modals.tallyReport.reversedNote');
    wrapper.appendChild(note);
  }

  // Group details
  if (step.groups) {
    const keys = Object.keys(step.groups).sort((a, b) =>
      step.reversed ? Number.parseFloat(a) - Number.parseFloat(b) : Number.parseFloat(b) - Number.parseFloat(a),
    );

    for (const key of keys) {
      const names = step.groups[key].map(getName).join(', ');
      const row = document.createElement('div');
      row.style.cssText = 'padding: 1px 0 1px 12px;';

      const valueSpan = document.createElement('span');
      valueSpan.style.cssText = 'font-weight: 500; min-width: 40px; display: inline-block;';
      valueSpan.textContent = key;

      const nameSpan = document.createElement('span');
      nameSpan.textContent = ` — ${names}`;

      row.appendChild(valueSpan);
      row.appendChild(nameSpan);
      wrapper.appendChild(row);
    }
  }

  // Head-to-head result
  if (step.attribute === 'head2Head' && step.headToHeadWinner) {
    const h2h = document.createElement('div');
    h2h.style.cssText = 'padding: 1px 0 1px 12px; font-weight: 500;';
    h2h.textContent = `${t('modals.tallyReport.h2hWinner')}: ${getName(step.headToHeadWinner)}`;
    wrapper.appendChild(h2h);
  }

  return wrapper;
}

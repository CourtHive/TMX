import {
  CompletenessGroup,
  DrawCompleteness,
  StructureGroup,
  Inconsistency,
  auditTournament,
  DrawAudit,
} from './structureAuditData';
import { cModal } from 'courthive-components';

// Admin/director-facing structure-integrity audit. Runs the factory's read-only
// getStructureInconsistencies check on every draw of the loaded tournament (via the DOM-free
// structureAuditData layer) and renders the flagged inconsistencies grouped by draw →
// structure. All colours are driven from --tmx-* theme tokens so the panel tracks the active
// light/dark theme.

const PANEL_BG = 'var(--tmx-bg-primary)';
const TEXT_PRIMARY = 'var(--tmx-text-primary)';
const TEXT_SECONDARY = 'var(--tmx-text-secondary)';
const BORDER = 'var(--tmx-border-primary)';
const BADGE = 'rgba(239,68,68,0.15)';
const BADGE_TEXT = 'var(--tmx-status-error, #ef4444)';
const INFO_TEXT = 'var(--tmx-accent-blue, #4a90d9)';
const SECTION_HEADING = `font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: ${TEXT_SECONDARY}; margin: 4px 0 8px 0;`;

function issueRow(issue: Inconsistency & { matchUpLabel?: string }): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = `display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid ${BORDER};`;

  const badge = document.createElement('span');
  badge.style.cssText = `flex: none; font-size: 0.625rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${BADGE}; color: ${BADGE_TEXT}; white-space: nowrap;`;
  badge.textContent = issue.issueType;

  const body = document.createElement('span');
  body.style.cssText = `font-size: 0.75rem; color: ${TEXT_PRIMARY}; line-height: 1.4;`;
  const where = issue.matchUpLabel ? `${issue.matchUpLabel} — ` : '';
  body.textContent = `${where}${issue.message}`;

  row.append(badge, body);
  return row;
}

function structureBlock(group: StructureGroup): HTMLElement {
  const block = document.createElement('div');
  block.style.cssText = 'margin: 6px 0 10px 0;';

  const header = document.createElement('div');
  header.style.cssText = `font-size: 0.75rem; font-weight: 600; color: ${TEXT_SECONDARY}; margin-bottom: 2px;`;
  header.textContent = `${group.label} · ${group.issues.length} issue${group.issues.length === 1 ? '' : 's'}`;
  block.appendChild(header);

  group.issues.forEach((issue) => block.appendChild(issueRow(issue)));
  return block;
}

function drawBlock(audit: DrawAudit): HTMLElement {
  const block = document.createElement('div');
  block.style.cssText = `margin-bottom: 16px; padding: 10px 12px; border: 1px solid ${BORDER}; border-radius: 6px; background: var(--tmx-bg-secondary);`;

  const heading = document.createElement('div');
  heading.style.cssText = `font-size: 0.875rem; font-weight: 700; color: ${TEXT_PRIMARY}; margin-bottom: 6px;`;
  heading.textContent = `${audit.eventName} — ${audit.drawName}`;
  block.appendChild(heading);

  audit.groups.forEach((group) => block.appendChild(structureBlock(group)));
  return block;
}

// ---- "still outstanding" (completeness) rendering ----

function outstandingDetail(group: CompletenessGroup): string {
  const parts: string[] = [];
  if (group.unassignedPositions.length) {
    parts.push(`${group.unassignedPositions.length} unassigned (pos ${group.unassignedPositions.join(', ')})`);
  }
  if (group.unplayedMatchUps.length) {
    parts.push(`${group.unplayedMatchUps.length} unplayed`);
  }
  return parts.join(' · ');
}

function completenessRow(group: CompletenessGroup): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = `display: flex; align-items: baseline; gap: 8px; padding: 5px 0; border-bottom: 1px solid ${BORDER};`;

  const label = document.createElement('span');
  label.style.cssText = `flex: none; font-size: 0.75rem; font-weight: 600; color: ${INFO_TEXT};`;
  label.textContent = group.label;

  const detail = document.createElement('span');
  detail.style.cssText = `font-size: 0.75rem; color: ${TEXT_PRIMARY}; line-height: 1.4;`;
  detail.textContent = outstandingDetail(group);

  row.append(label, detail);
  return row;
}

function completenessBlock(draw: DrawCompleteness): HTMLElement {
  const block = document.createElement('div');
  block.style.cssText = `margin-bottom: 16px; padding: 10px 12px; border: 1px solid ${BORDER}; border-radius: 6px; background: var(--tmx-bg-secondary);`;

  const heading = document.createElement('div');
  heading.style.cssText = `font-size: 0.875rem; font-weight: 700; color: ${TEXT_PRIMARY}; margin-bottom: 6px;`;
  heading.textContent = `${draw.eventName} — ${draw.drawName}`;
  block.appendChild(heading);

  draw.groups.forEach((group) => block.appendChild(completenessRow(group)));
  return block;
}

function sectionHeading(text: string): HTMLElement {
  const heading = document.createElement('div');
  heading.style.cssText = SECTION_HEADING;
  heading.textContent = text;
  return heading;
}

function inconsistenciesSection(audits: DrawAudit[], drawCount: number): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = 'margin-bottom: 20px;';
  section.appendChild(sectionHeading('Inconsistencies'));

  const issueCount = audits.reduce((sum, audit) => sum + audit.groups.reduce((n, g) => n + g.issues.length, 0), 0);
  const summary = document.createElement('div');
  summary.style.cssText = `font-size: 0.8125rem; margin-bottom: 10px; color: ${issueCount ? TEXT_SECONDARY : 'var(--tmx-status-success, #48c774)'};`;
  summary.textContent = issueCount
    ? `${issueCount} inconsistenc${issueCount === 1 ? 'y' : 'ies'} across ${audits.length} of ${drawCount} draw${drawCount === 1 ? '' : 's'}.`
    : `✓ No structure inconsistencies found across ${drawCount} draw${drawCount === 1 ? '' : 's'}.`;
  section.appendChild(summary);

  audits.forEach((audit) => section.appendChild(drawBlock(audit)));
  return section;
}

function outstandingSection(completeness: DrawCompleteness[], drawCount: number): HTMLElement {
  const section = document.createElement('div');
  section.appendChild(sectionHeading('Still outstanding'));

  const summary = document.createElement('div');
  const outstandingDraws = completeness.length;
  summary.style.cssText = `font-size: 0.8125rem; margin-bottom: 10px; color: ${outstandingDraws ? TEXT_SECONDARY : 'var(--tmx-status-success, #48c774)'};`;
  summary.textContent = outstandingDraws
    ? `${outstandingDraws} of ${drawCount} draw${drawCount === 1 ? '' : 's'} not yet fully populated and played.`
    : `✓ All ${drawCount} draw${drawCount === 1 ? '' : 's'} fully populated and played.`;
  section.appendChild(summary);

  completeness.forEach((draw) => section.appendChild(completenessBlock(draw)));
  return section;
}

function buildAuditContent(): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = `padding: 12px 4px; max-height: 70vh; overflow-y: auto; background: ${PANEL_BG};`;

  const { audits, completeness, drawCount } = auditTournament();

  if (!drawCount) {
    const summary = document.createElement('div');
    summary.style.cssText = `font-size: 0.8125rem; color: ${TEXT_SECONDARY};`;
    summary.textContent = 'This tournament has no generated draws to audit.';
    container.appendChild(summary);
    return container;
  }

  container.append(inconsistenciesSection(audits, drawCount), outstandingSection(completeness, drawCount));
  return container;
}

export function openStructureAuditModal(): void {
  cModal.open({
    title: 'Structure Integrity Audit',
    content: buildAuditContent(),
    buttons: [{ label: 'Close', close: true }],
    config: { maxWidth: 760 },
  });
}

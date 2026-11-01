/**
 * Pure formatting of record validation findings: CODES schema errors (ajv) plus the
 * factory's integrity inconsistencies, merged into one summary the UI and the dev
 * console can render. No DOM, no i18n: callers own presentation.
 */
import type { SchemaError } from './schemaValidator';

export type FindingSource = 'schema' | 'integrity';
export type FindingSeverity = 'error' | 'warning' | 'info';

export type ValidationFinding = {
  source: FindingSource;
  severity: FindingSeverity;
  path: string;
  message: string;
  issueType?: string;
};

export type RecordValidationSummary = {
  count: number;
  schemaErrorCount: number;
  inconsistencyCount: number;
  findings: ValidationFinding[];
  preview: ValidationFinding[];
  // every finding, one per line, for copying
  text: string;
  schemaUnavailable?: boolean;
};

export const DEFAULT_PREVIEW_COUNT = 5;

const SEVERITY_ORDER: Record<FindingSeverity, number> = { error: 0, warning: 1, info: 2 };

function inconsistencyPath(inconsistency: any): string {
  const ids = [
    inconsistency.eventId && `event ${inconsistency.eventId}`,
    inconsistency.drawId && `draw ${inconsistency.drawId}`,
    inconsistency.structureId && `structure ${inconsistency.structureId}`,
    inconsistency.matchUpId && `matchUp ${inconsistency.matchUpId}`,
  ].filter(Boolean);
  return ids.length ? ids.join(' / ') : (inconsistency.scope ?? 'TOURNAMENT');
}

export function formatFinding(finding: ValidationFinding): string {
  const label = finding.issueType ? `${finding.issueType} ` : '';
  return `[${finding.severity}] ${label}${finding.path}: ${finding.message}`;
}

export function summarizeRecordValidation({
  schemaErrors = [],
  inconsistencies = [],
  previewCount = DEFAULT_PREVIEW_COUNT,
  schemaUnavailable,
}: {
  schemaErrors?: SchemaError[];
  inconsistencies?: any[];
  previewCount?: number;
  schemaUnavailable?: boolean;
}): RecordValidationSummary {
  const schemaFindings: ValidationFinding[] = schemaErrors.map((error) => ({
    source: 'schema',
    severity: 'error',
    path: error.instancePath || '/',
    message: error.message,
  }));

  const integrityFindings: ValidationFinding[] = inconsistencies.map((inconsistency) => ({
    source: 'integrity',
    severity:
      SEVERITY_ORDER[inconsistency.severity as FindingSeverity] === undefined ? 'error' : inconsistency.severity,
    path: inconsistencyPath(inconsistency),
    message: inconsistency.message,
    issueType: inconsistency.issueType,
  }));

  // schema errors first (in ajv's order), then integrity findings by severity
  const findings = [
    ...schemaFindings,
    ...integrityFindings.toSorted((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
  ];

  return {
    count: findings.length,
    schemaErrorCount: schemaFindings.length,
    inconsistencyCount: integrityFindings.length,
    findings,
    preview: findings.slice(0, previewCount),
    text: findings.map(formatFinding).join('\n'),
    ...(schemaUnavailable && { schemaUnavailable }),
  };
}

// Only enumerated categories cross the report boundary. No raw errors, params, IDs or console text.
export const SUPPORT_CODES = [
  'ERR_INVALID_CATEGORY',
  'ERR_INVALID_GENDER',
  'ERR_INVALID_PARTICIPANT',
  'ERR_INVALID_PARTICIPANT_IDS',
  'ERR_INVALID_ENTRIES',
  'ERR_MISSING_TOURNAMENT',
  'ERR_MISSING_EVENT_ID',
  'ERR_NOT_FOUND_PARTICIPANT',
  'UNCLASSIFIED',
  'INVALID_PARTICIPANTS',
  'NOT_AUTHORIZED',
  'NOT_LOGGED_IN',
  'STALE_DATA',
  'OFFLINE',
  'HTTP_CLIENT_ERROR',
  'HTTP_SERVER_ERROR',
  'NETWORK_ERROR',
  'MUTATION_REFUSED',
];
export const SUPPORT_METHODS = [
  'unknown',
  'addEvent',
  'addDrawDefinition',
  'addEventEntries',
  'addParticipants',
  'setMatchUpStatus',
  'setMatchUpSchedule',
  'modifyEvent',
  'removeEvent',
  'removeDrawDefinition',
];
export const SUPPORT_ROUTES = [
  'tournaments',
  'tournament',
  'events',
  'participants',
  'schedule',
  'venues',
  'settings',
  'other',
];
export const FINDING_CODES = [
  'UNSPECIFIED',
  'PARTICIPANT_ROLE_MISSING',
  'PARTICIPANT_ROLE_INVALID',
  'PARTICIPANT_IDENTITY_DUPLICATION',
  'MATCHUP_FORMAT_MALFORMED',
  'MATCHUP_FORMAT_REFUSED_FOR_NEW_USE',
];
export type SupportDiagnostic = { time: string; code: string; method: string; route: string };

export function reportRoute(hash: string): string {
  // Explicit route positions: never return a user-controlled segment or an entity ID.
  const path = hash.split('?')[0].replace(/^#\/?/, '').split('/');
  if (path[0] === 'tournaments') return 'tournaments';
  if (path[0] === 'settings') return 'settings';
  if (path[0] !== 'tournament') return 'other';
  return ['events', 'participants', 'schedule', 'venues', 'settings'].includes(path[2]) ? path[2] : 'tournament';
}

export class SupportDiagnosticBuffer {
  private scope = '';
  private items: SupportDiagnostic[] = [];
  snapshot(scope: string): SupportDiagnostic[] {
    if (scope !== this.scope) {
      this.items = [];
      this.scope = scope;
    }
    return structuredClone(this.items);
  }
  record(scope: string, input: { code?: unknown; method?: unknown; route?: unknown }) {
    this.snapshot(scope);
    if (!scope) return;
    const entry = {
      time: new Date().toISOString(),
      code: SUPPORT_CODES.includes(String(input.code)) ? String(input.code) : 'UNCLASSIFIED',
      method: SUPPORT_METHODS.includes(String(input.method)) ? String(input.method) : 'unknown',
      route: SUPPORT_ROUTES.includes(String(input.route)) ? String(input.route) : 'other',
    };
    this.items.push(entry);
    while (this.items.length > 50 || new TextEncoder().encode(JSON.stringify(this.items)).length > 65_536)
      this.items.shift();
  }
}

export function safeValidation(summary?: any) {
  const count = (value: unknown) =>
    Number.isSafeInteger(value) && Number(value) >= 0 ? Math.min(Number(value), 1_000_000) : 0;
  const findings = Array.isArray(summary?.findings) ? summary.findings : [];
  return {
    factoryVersion:
      typeof summary?.factoryVersion === 'string' &&
      /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(summary.factoryVersion) &&
      summary.factoryVersion.length <= 60
        ? summary.factoryVersion
        : 'unknown',
    count: count(summary?.count),
    schemaErrorCount: count(summary?.schemaErrorCount),
    inconsistencyCount: count(summary?.inconsistencyCount),
    schemaUnavailable: !summary || !!summary.schemaUnavailable,
    integrityUnavailable: !summary || !!summary.integrityUnavailable,
    truncated: findings.length > 100,
    codes: findings.slice(0, 100).map((f: any) => (FINDING_CODES.includes(f?.issueType) ? f.issueType : 'UNSPECIFIED')),
  };
}

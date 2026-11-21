import { SupportDiagnosticBuffer, reportRoute, safeValidation } from './diagnostics';
import { describe, expect, it } from 'vitest';

const SCOPE = 'operator|provider';

describe('support evidence minimization', () => {
  it('retains only bounded categories and never IDs, names, raw errors or params', () => {
    const buffer = new SupportDiagnosticBuffer();
    for (let i = 0; i < 70; i++)
      buffer.record(SCOPE, {
        code: 'Alice Smith',
        method: 'participant-secret',
        route: '/person/secret',
      });
    const entries = buffer.snapshot(SCOPE);
    expect(entries).toHaveLength(50);
    expect(entries[0]).toMatchObject({ code: 'UNCLASSIFIED', method: 'unknown', route: 'other' });
    expect(JSON.stringify(entries)).not.toMatch(/Alice|participant-secret|person\/secret/);
    entries[0].code = 'tampered';
    expect(buffer.snapshot(SCOPE)[0].code).toBe('UNCLASSIFIED');
    expect(buffer.snapshot('another-operator|provider')).toEqual([]);
    buffer.record('', { code: 'MUTATION_REFUSED' });
    expect(buffer.snapshot('')).toEqual([]);
  });

  it('returns route templates from fixed positions only', () => {
    expect(reportRoute('#/tournament/secret-id/events?name=Alice')).toBe('events');
    expect(reportRoute('#/tournament/secret-id/private-person')).toBe('tournament');
    expect(reportRoute('#/Alice/events')).toBe('other');
  });

  it('strips validation paths, messages, record content and unsafe codes', () => {
    const summary = {
      count: 101,
      schemaErrorCount: 1,
      inconsistencyCount: 100,
      findings: Array.from({ length: 101 }, () => ({
        issueType: 'private-name',
        path: '/participants/secret',
        message: 'Alice born 2012',
        tournamentRecord: { participants: ['Alice'] },
      })),
    };
    const safe = safeValidation(summary);
    expect(safe.codes).toHaveLength(100);
    expect(safe.truncated).toBe(true);
    expect(JSON.stringify(safe)).not.toMatch(/private-name|Alice|participants|secret|2012/);
    expect(safeValidation()).toMatchObject({ schemaUnavailable: true, integrityUnavailable: true });
    expect(safeValidation({ count: 1, findings: [{ issueType: 'PARTICIPANT_ROLE_MISSING' }] }).codes).toEqual([
      'PARTICIPANT_ROLE_MISSING',
    ]);
  });
});

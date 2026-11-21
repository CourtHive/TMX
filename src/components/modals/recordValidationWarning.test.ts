/**
 * The import warning toast: a clean, fully checked record shows nothing; a record with
 * findings, or one whose schema or integrity check could not run, always warns — even at
 * zero findings, so an unchecked record never looks clean.
 */
import { summarizeRecordValidation } from 'services/validation/recordValidationSummary';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSpy = vi.hoisted(() => vi.fn());
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: toastSpy }));
vi.mock('./baseModal/baseModal', () => ({ openModal: vi.fn() }));
vi.mock('i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
}));

import { unavailableLines, warnOnRecordValidation } from './recordValidationWarning';

describe('warnOnRecordValidation', () => {
  beforeEach(() => toastSpy.mockClear());

  it('shows nothing for a clean, fully checked record or no summary', () => {
    warnOnRecordValidation(undefined);
    warnOnRecordValidation(summarizeRecordValidation({ factoryVersion: '7.39.0' }));
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('warns at zero findings when the integrity check was unavailable', () => {
    warnOnRecordValidation(
      summarizeRecordValidation({ integrityUnavailable: true, integrityUnavailableReason: 'boom' }),
    );
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy.mock.calls[0][0]).toMatchObject({
      message: 'modals.recordValidation.incompleteToast',
      intent: 'is-warning',
    });
    expect(toastSpy.mock.calls[0][0].action.text).toEqual('modals.recordValidation.review');
  });

  it('warns at zero findings when the schema validator was unavailable', () => {
    warnOnRecordValidation(summarizeRecordValidation({ schemaUnavailable: true }));
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy.mock.calls[0][0].message).toEqual('modals.recordValidation.incompleteToast');
  });

  it('keeps the issue-count toast when there are findings', () => {
    warnOnRecordValidation(
      summarizeRecordValidation({
        inconsistencies: [{ issueType: 'X', message: 'm', severity: 'error' }],
        schemaUnavailable: true,
      }),
    );
    expect(toastSpy.mock.calls[0][0].message).toEqual('modals.recordValidation.toast {"count":1}');
  });
});

describe('unavailableLines', () => {
  it('names the factory version and reason when the integrity check could not run', () => {
    const lines = unavailableLines(
      summarizeRecordValidation({
        integrityUnavailable: true,
        integrityUnavailableReason: 'boom',
        factoryVersion: '7.39.0',
        schemaUnavailable: true,
      }),
    );
    expect(lines).toEqual([
      'modals.recordValidation.schemaUnavailable',
      'modals.recordValidation.integrityUnavailable {"version":"7.39.0","reason":"boom"}',
    ]);
  });

  it('is empty for a fully checked record', () => {
    expect(unavailableLines(summarizeRecordValidation({}))).toEqual([]);
  });
});

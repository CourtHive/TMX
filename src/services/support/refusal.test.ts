import { describe, expect, it, vi } from 'vitest';
import { refusalText } from './refusal';

vi.mock('services/support/text', () => ({ supportText: (key: string) => `text:${key}` }));

const refused = (data: unknown) => ({ response: { status: 403, data } });
const FAILED = 'text:failed';

describe('refusalText', () => {
  it('names the reason CFS gave for a refused report', () => {
    expect(refusalText(refused({ code: 'SUPPORT_NO_SESSION_PROVIDER' }))).toBe('text:noProvider');
    expect(refusalText(refused({ code: 'SUPPORT_PROVIDER_NOT_PERMITTED' }))).toBe('text:notPermitted');
    expect(refusalText({ response: { status: 503, data: { code: 'SUPPORT_INTAKE_DISABLED' } } })).toBe('text:disabled');
    expect(refusalText(refused({ code: 'SUPPORT_SESSION_CHANGED' }))).toBe('text:changed');
  });

  it('keeps the generic promise for an unmapped refusal, with the server reason when it gave one', () => {
    expect(refusalText(refused({ code: 'SUPPORT_SOMETHING_NEW', message: 'Reason' }))).toBe(`${FAILED} (Reason)`);
    expect(refusalText(refused({ message: 'x'.repeat(161) }))).toBe(FAILED);
    expect(refusalText(new Error('report-not-confirmed'))).toBe(FAILED);
    expect(refusalText(undefined)).toBe(FAILED);
  });
});

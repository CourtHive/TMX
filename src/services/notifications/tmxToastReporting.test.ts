import { afterEach, describe, expect, it, vi } from 'vitest';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('./toaster', () => ({ toast }));
vi.mock('services/support/reportAvailability', () => ({ supportReportingAvailable: () => true }));
vi.mock('services/support/reportContext', () => ({ recordSupportDiagnostic: vi.fn() }));
vi.mock('services/support/text', () => ({ supportText: (key: string) => key }));

import { SUPPORT_DIALOG } from 'constants/tmxConstants';
import { tmxToast } from './tmxToast';

const withDocument = (open: boolean) =>
  vi.stubGlobal('document', { getElementById: (id: string) => (open && id === SUPPORT_DIALOG ? {} : null) });

afterEach(() => {
  vi.unstubAllGlobals();
  toast.mockClear();
});

describe('tmxToast report action', () => {
  it('offers "Report a problem" on an error toast in ordinary use', () => {
    withDocument(false);
    tmxToast({ message: 'Forbidden', intent: 'is-danger' });
    expect(toast.mock.calls[0][0].action?.text).toBe('report');
  });

  it('never offers it from inside the report form, so a failed report does not suggest reporting itself', () => {
    withDocument(true);
    tmxToast({ message: 'Forbidden', intent: 'is-danger' });
    expect(toast.mock.calls[0][0].action).toBeUndefined();
  });
});

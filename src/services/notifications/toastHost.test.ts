import { describe, expect, it } from 'vitest';
import { toastHost } from './toaster';

const fakeDoc = (modal: unknown, throws = false): any => ({
  body: { id: 'body' },
  querySelector: (selector: string) => {
    if (throws) throw new Error('unsupported selector');
    return selector === 'dialog:modal' ? modal : null;
  },
});

describe('toastHost', () => {
  it('renders toasts inside an open modal dialog, where they can be seen and clicked', () => {
    const dialog = { id: 'report-dialog' };
    expect(toastHost(fakeDoc(dialog))).toBe(dialog);
  });

  it('falls back to the requested container, then the body, when no modal is open', () => {
    const own = { id: 'own' } as any;
    expect(toastHost(fakeDoc(null), own)).toBe(own);
    expect(toastHost(fakeDoc(null))).toEqual({ id: 'body' });
  });

  it('keeps the previous behaviour where :modal is unsupported', () => {
    expect(toastHost(fakeDoc(null, true))).toEqual({ id: 'body' });
  });
});

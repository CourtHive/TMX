import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks must be declared before importing the module under test
vi.mock('./baseModal/baseModal', () => ({
  openModal: vi.fn(),
}));
vi.mock('services/mutation/mutationRequest', () => ({
  mutationRequest: vi.fn(),
}));
vi.mock('functions/isDev', () => ({
  isDev: vi.fn(),
}));
vi.mock('tods-competition-factory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('tods-competition-factory')>();
  return {
    ...actual,
    tournamentEngine: {
      ...(actual.tournamentEngine ?? {}),
      getEvents: vi.fn(),
    },
  };
});
vi.mock('courthive-components', () => ({
  renderForm: vi.fn(() => ({})),
  validators: {
    wordValidator: () => () => true,
  },
}));
vi.mock('i18n', () => ({
  t: (key: string) => key,
}));

import { openModal } from './baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { isDev } from 'functions/isDev';
import { tournamentEngine } from 'tods-competition-factory';
import { deleteEvents } from './deleteEvents';

const mockOpenModal = vi.mocked(openModal);
const mockMutationRequest = vi.mocked(mutationRequest);
const mockIsDev = vi.mocked(isDev);
const mockGetEvents = vi.mocked(tournamentEngine.getEvents);

describe('deleteEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEvents.mockReturnValue({ events: [{}, {}, {}] } as any); // 3 events total
  });

  it('always opens a confirmation modal — no immediate mutation even in dev', () => {
    mockIsDev.mockReturnValue(true);
    deleteEvents({ eventIds: ['e1'] });

    // Critical regression guard: the dev-mode shortcut used to skip the modal
    // and fire the mutation immediately. That's the bug this test prevents.
    expect(mockMutationRequest).not.toHaveBeenCalled();
    expect(mockOpenModal).toHaveBeenCalledTimes(1);
  });

  it('always opens a confirmation modal in prod', () => {
    mockIsDev.mockReturnValue(false);
    deleteEvents({ eventIds: ['e1'] });

    expect(mockMutationRequest).not.toHaveBeenCalled();
    expect(mockOpenModal).toHaveBeenCalledTimes(1);
  });

  it('does nothing when eventIds is empty', () => {
    mockIsDev.mockReturnValue(false);
    deleteEvents({ eventIds: [] });

    expect(mockOpenModal).not.toHaveBeenCalled();
    expect(mockMutationRequest).not.toHaveBeenCalled();
  });

  it('shows emphasized warning text when deleting 5+ events', () => {
    mockIsDev.mockReturnValue(false);
    mockGetEvents.mockReturnValue({ events: Array.from({ length: 10 }, () => ({})) } as any);
    deleteEvents({ eventIds: ['a', 'b', 'c', 'd', 'e'] });

    expect(mockOpenModal).toHaveBeenCalledTimes(1);
    // We can't inspect the rendered modal body without DOM, but the contract is
    // that the call is made and carries the right configuration. At minimum,
    // the title & buttons are passed through; deeper body inspection is for
    // a future DOM-capable test environment.
    const call = mockOpenModal.mock.calls[0][0];
    expect(call).toHaveProperty('title');
    expect(call).toHaveProperty('buttons');
    // Buttons array contains Cancel and Delete (id=deleteEvent)
    expect(call.buttons.some((b: any) => b.id === 'deleteEvent' && b.intent === 'is-danger')).toBe(true);
  });

  it('shows the same modal path when deleting ALL events', () => {
    mockIsDev.mockReturnValue(false);
    mockGetEvents.mockReturnValue({ events: [{}, {}, {}] } as any);
    deleteEvents({ eventIds: ['a', 'b', 'c'] }); // 3 == total

    expect(mockOpenModal).toHaveBeenCalledTimes(1);
    expect(mockMutationRequest).not.toHaveBeenCalled();
  });

  it('delete button is pre-enabled in dev (auditReason prefilled)', () => {
    mockIsDev.mockReturnValue(true);
    deleteEvents({ eventIds: ['e1'] });

    const call = mockOpenModal.mock.calls[0][0];
    const deleteBtn = call.buttons.find((b: any) => b.id === 'deleteEvent');
    expect(deleteBtn).toBeDefined();
    expect(deleteBtn?.disabled).toBe(false);
  });

  it('delete button is disabled by default in prod (awaiting valid reason)', () => {
    mockIsDev.mockReturnValue(false);
    deleteEvents({ eventIds: ['e1'] });

    const call = mockOpenModal.mock.calls[0][0];
    const deleteBtn = call.buttons.find((b: any) => b.id === 'deleteEvent');
    expect(deleteBtn).toBeDefined();
    expect(deleteBtn?.disabled).toBe(true);
  });
});

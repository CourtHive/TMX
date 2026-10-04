import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A walkover or default recorded before the second opponent arrives (CA, 2026-10-04): the factory offers it
 * as the EXIT matchUp action, and TMX submits the action's own payload with the director's choice.
 */
const mutationRequestMock = vi.fn();
const closeModalMock = vi.fn();
let modalParams: any;
let formItems: any[] = [];
let installedDocument = false;

vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: (...a: any[]) => mutationRequestMock(...a) }));
vi.mock('components/modals/baseModal/baseModal', () => ({
  openModal: (params: any) => (modalParams = params),
  closeModal: () => closeModalMock(),
}));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('courthive-components', () => ({ renderForm: (_: any, items: any[]) => (formItems = items) }));
vi.mock('services/factory/engine', () => ({
  tournamentEngine: {
    matchUpActions: () => ({ validActions: [{ type: 'SCORE' }, EXIT_ACTION] }),
    findPolicy: () => ({
      policy: {
        matchUpStatusCodes: { DEFAULTED: [{ matchUpStatusCode: 'DM', matchUpStatusCodeDisplay: 'Def [cond]' }] },
      },
    }),
  },
}));
vi.mock('i18n', () => ({ t: (k: string) => k }));

const EXIT_ACTION = {
  type: 'EXIT',
  method: 'setMatchUpStatus',
  payload: {
    drawId: 'd1',
    matchUpId: 'm1',
    exitingParticipantId: 'p1',
    exitingSideNumber: 1,
    matchUpStatuses: ['WALKOVER', 'DEFAULTED'],
    outcome: { matchUpStatus: undefined, winningSide: 2 },
  },
};
const MATCHUP = {
  eventId: 'e1',
  sides: [{ sideNumber: 1, participant: { participantName: 'Ann' } }, { sideNumber: 2 }],
};

import { exitBeforeArrivalAction, recordExitBeforeArrival } from './recordExitBeforeArrival';

function choose(value: string) {
  modalParams.content(fakeElement());
  const submit = modalParams.buttons.find((button: any) => button.intent === 'is-danger');
  submit.onClick({ content: { exit: { value } } });
}

function fakeElement(): any {
  const element: any = { style: {}, children: [] as any[], appendChild: (child: any) => element.children.push(child) };
  return element;
}

describe('recordExitBeforeArrival', () => {
  beforeEach(() => {
    mutationRequestMock.mockClear();
    closeModalMock.mockClear();
    modalParams = undefined;
    formItems = [];
    // TMX unit tests run in the node environment; the modal body creates one paragraph
    if (!(globalThis as any).document) {
      (globalThis as any).document = { createElement: () => fakeElement() };
      installedDocument = true;
    }
  });
  afterEach(() => {
    if (installedDocument) delete (globalThis as any).document;
    installedDocument = false;
  });

  it('finds the EXIT action the factory offers', () => {
    expect(exitBeforeArrivalAction({ matchUpId: 'm1', drawId: 'd1' })).toEqual(EXIT_ACTION);
  });

  it('offers each status, then each reason code the event policy gives it', () => {
    recordExitBeforeArrival({ action: EXIT_ACTION, matchUp: MATCHUP });
    modalParams.content(fakeElement());
    expect(formItems[0].options.map((option: any) => option.value)).toEqual(['WALKOVER', 'DEFAULTED', 'DEFAULTED|DM']);
  });

  it('submits the payload with the chosen status and reason, awarding the empty side', () => {
    recordExitBeforeArrival({ action: EXIT_ACTION, matchUp: MATCHUP });
    choose('DEFAULTED|DM');
    const [{ methods }] = mutationRequestMock.mock.calls[0];
    expect(methods).toEqual([
      {
        method: 'setMatchUpStatus',
        params: {
          drawId: 'd1',
          matchUpId: 'm1',
          outcome: { matchUpStatus: 'DEFAULTED', winningSide: 2, matchUpStatusCodes: ['DM'] },
        },
      },
    ]);
  });

  it('sends no matchUpStatusCodes when no reason is chosen (an empty array would blank them)', () => {
    recordExitBeforeArrival({ action: EXIT_ACTION, matchUp: MATCHUP });
    choose('WALKOVER');
    const [{ methods }] = mutationRequestMock.mock.calls[0];
    expect(methods[0].params.outcome).toEqual({ matchUpStatus: 'WALKOVER', winningSide: 2 });
  });
});

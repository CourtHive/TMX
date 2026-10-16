import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => {
  // The package's date-picker dependency creates a range at import time.
  vi.stubGlobal('document', {
    documentElement: { style: {} },
    createRange: () => ({}),
    body: { innerHTML: '' },
    createElement: () => ({ style: {} }),
    getElementById: () => null,
  });
  return { handlers: {} as any, renders: 0, request: undefined as any };
});
vi.mock('courthive-components', async (original) => {
  const actual = await original<typeof import('courthive-components')>();
  return {
    ...actual,
    renderStructure: (params: any) => {
      harness.handlers = params.eventHandlers;
      harness.renders++;
      return document.createElement('div');
    },
    renderContainer: ({ content }: any) => content,
    controlBar: vi.fn(),
  };
});
vi.mock('services/mutation/mutationRequest', () => ({
  mutationRequest: (request: any) => {
    harness.request = request;
  },
}));
vi.mock('services/compositions/resolveCompositionByName', () => ({ resolveCompositionByName: () => undefined }));
vi.mock('./renderDrawView', () => ({ renderDrawView: vi.fn() }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

import { enterParticipantAssignmentMode, forceExitAssignmentMode } from './participantAssignmentMode';

describe('assignment mode mutation ownership', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { body: { innerHTML: '' }, createElement: () => ({}), getElementById: () => null });
    forceExitAssignmentMode();
    harness.renders = 0;
    harness.request = undefined;
    document.body.innerHTML = '';
  });

  it('preserves a change made after entering assignment mode and executes an acknowledged assignment once', () => {
    let result: any = mocksEngine.generateTournamentRecord({
      setState: true,
      nonRandom: 1,
      drawProfiles: [{ drawSize: 8, automated: false }],
      participantsProfile: { participantsCount: 16 },
    });
    const record = result.tournamentRecord;
    const event = record.events[0];
    const draw = event.drawDefinitions[0];
    enterParticipantAssignmentMode({
      eventId: event.eventId,
      drawId: draw.drawId,
      structureId: draw.structures[0].structureId,
    });
    const updated = tournamentEngine.q.tournament()!;
    updated.tournamentName = 'Remote change after mode opened';
    tournamentEngine.setState(updated);
    harness.handlers.assignParticipant({ side: { drawPosition: 1 }, participant: record.participants[0] });
    const assign = vi.spyOn(tournamentEngine, 'assignDrawPosition');
    const method = harness.request.methods[0];
    result = tournamentEngine.assignDrawPosition(method.params);
    expect(result.success).toBe(true);
    harness.request.callback(result);
    expect(tournamentEngine.q.tournament()?.tournamentName).toBe('Remote change after mode opened');
    expect(assign).toHaveBeenCalledTimes(1);
    assign.mockRestore();
  });

  it('does not report a refused request as an applied assignment or rerender it', () => {
    let result: any = mocksEngine.generateTournamentRecord({
      setState: true,
      nonRandom: 1,
      drawProfiles: [{ drawSize: 8, automated: false }],
      participantsProfile: { participantsCount: 16 },
    });
    const event = result.tournamentRecord.events[0];
    const draw = event.drawDefinitions[0];
    enterParticipantAssignmentMode({
      eventId: event.eventId,
      drawId: draw.drawId,
      structureId: draw.structures[0].structureId,
    });
    const renders = harness.renders;
    harness.handlers.assignBye({ side: { drawPosition: 1 } });
    harness.request.callback({ error: 'refused' });
    expect(harness.renders).toBe(renders);
    expect(
      tournamentEngine.q
        .tournament()
        ?.events?.[0].drawDefinitions?.[0].structures?.[0].positionAssignments?.every((p: any) => !p.bye),
    ).toBe(true);
  });
});

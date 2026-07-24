/**
 * Schedule-scenarios service: reads hit the engine directly, writes go through
 * mutationRequest with the correct factory method + params. Mirrors the
 * queueService.test.ts mocking house pattern.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  mutationRequestMock,
  getScheduleScenariosMock,
  getScenarioScheduleProjectionMock,
  getScheduleScenarioStatusMock,
} = vi.hoisted(() => ({
  mutationRequestMock: vi.fn(),
  getScheduleScenariosMock: vi.fn(),
  getScenarioScheduleProjectionMock: vi.fn(),
  getScheduleScenarioStatusMock: vi.fn(),
}));

vi.mock('services/mutation/mutationRequest', () => ({
  mutationRequest: mutationRequestMock,
}));

vi.mock('services/factory/engine', () => ({
  competitionEngine: {
    getScheduleScenarios: getScheduleScenariosMock,
    getScenarioScheduleProjection: getScenarioScheduleProjectionMock,
    getScheduleScenarioStatus: getScheduleScenarioStatusMock,
  },
}));

import {
  removeScheduleScenario,
  updateScheduleScenario,
  rebaseScheduleScenario,
  listScheduleScenarios,
  applyScheduleScenario,
  getScenarioProjection,
  addScheduleScenario,
  getScenarioStatus,
} from 'services/scheduleScenarios/scheduleScenariosService';
import { COMPETITION_ENGINE } from 'constants/tmxConstants';

const TID = 'tournament-1';

afterEach(() => vi.clearAllMocks());

describe('reads call the engine directly', () => {
  it('listScheduleScenarios returns scenarios, defaulting to []', () => {
    getScheduleScenariosMock.mockReturnValueOnce({ scenarios: [{ scenarioId: 's1' }] });
    expect(listScheduleScenarios(TID)).toEqual([{ scenarioId: 's1' }]);
    expect(getScheduleScenariosMock).toHaveBeenCalledWith({ tournamentId: TID });

    getScheduleScenariosMock.mockReturnValueOnce({});
    expect(listScheduleScenarios(TID)).toEqual([]);

    getScheduleScenariosMock.mockReturnValueOnce(undefined);
    expect(listScheduleScenarios(TID)).toEqual([]);
  });

  it('getScenarioProjection / getScenarioStatus pass through', () => {
    getScenarioScheduleProjectionMock.mockReturnValueOnce({ scheduleCells: [], plannedMatchUpIds: [] });
    expect(getScenarioProjection(TID, 's1', ['v1'])).toEqual({ scheduleCells: [], plannedMatchUpIds: [] });
    expect(getScenarioScheduleProjectionMock).toHaveBeenCalledWith({
      tournamentId: TID,
      scenarioId: 's1',
      venueIds: ['v1'],
    });

    getScheduleScenarioStatusMock.mockReturnValueOnce({ outOfDate: true });
    expect(getScenarioStatus(TID, 's1')).toEqual({ outOfDate: true });
    expect(getScheduleScenarioStatusMock).toHaveBeenCalledWith({ tournamentId: TID, scenarioId: 's1' });
  });
});

describe('writes dispatch through mutationRequest', () => {
  function dispatchedMethods() {
    return mutationRequestMock.mock.calls[0][0].methods;
  }

  it('addScheduleScenario dispatches addScheduleScenario and resolves the callback result', async () => {
    mutationRequestMock.mockImplementationOnce(({ callback }: any) => callback({ success: true, scenarioId: 's9' }));
    const scenario = { scenarioName: 'Rain', placements: [] };
    const result = await addScheduleScenario(TID, scenario);
    expect(result).toEqual({ success: true, scenarioId: 's9' });
    expect(mutationRequestMock.mock.calls[0][0].engine).toEqual(COMPETITION_ENGINE);
    expect(dispatchedMethods()).toEqual([{ method: 'addScheduleScenario', params: { tournamentId: TID, scenario } }]);
  });

  it('updateScheduleScenario dispatches with scenarioId + updates', async () => {
    mutationRequestMock.mockImplementationOnce(({ callback }: any) => callback({ success: true }));
    await updateScheduleScenario(TID, 's1', { scenarioName: 'v2' });
    expect(dispatchedMethods()).toEqual([
      {
        method: 'updateScheduleScenario',
        params: { tournamentId: TID, scenarioId: 's1', updates: { scenarioName: 'v2' } },
      },
    ]);
  });

  it('removeScheduleScenario + rebaseScheduleScenario dispatch their methods', async () => {
    mutationRequestMock.mockImplementation(({ callback }: any) => callback({ success: true }));
    await removeScheduleScenario(TID, 's1');
    expect(mutationRequestMock.mock.calls[0][0].methods).toEqual([
      { method: 'removeScheduleScenario', params: { tournamentId: TID, scenarioId: 's1' } },
    ]);
    await rebaseScheduleScenario(TID, 's1');
    expect(mutationRequestMock.mock.calls[1][0].methods).toEqual([
      { method: 'rebaseScheduleScenario', params: { tournamentId: TID, scenarioId: 's1' } },
    ]);
  });

  it('applyScheduleScenario spreads options into params', async () => {
    mutationRequestMock.mockImplementationOnce(({ callback }: any) => callback({ success: true, applied: 4 }));
    const result = await applyScheduleScenario(TID, 's1', { removePriorValues: false });
    expect(result).toEqual({ success: true, applied: 4 });
    expect(dispatchedMethods()).toEqual([
      { method: 'applyScheduleScenario', params: { tournamentId: TID, scenarioId: 's1', removePriorValues: false } },
    ]);
  });

  it('applyScheduleScenario works with no options', async () => {
    mutationRequestMock.mockImplementationOnce(({ callback }: any) => callback({ success: true }));
    await applyScheduleScenario(TID, 's1');
    expect(dispatchedMethods()).toEqual([
      { method: 'applyScheduleScenario', params: { tournamentId: TID, scenarioId: 's1' } },
    ]);
  });
});

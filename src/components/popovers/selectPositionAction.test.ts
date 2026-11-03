import { mocksEngine, positionActionConstants, policyConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { selectPositionAction } from './selectPositionAction';
import { tournamentEngine } from 'services/factory/engine';
import { beforeEach, expect, it, vi } from 'vitest';
import { tipster } from './tipster';

vi.mock('components/modals/participantProfileModal', () => ({ participantProfileModal: vi.fn() }));
vi.mock('components/popovers/additionalSeedAction', () => ({ additionalSeedAction: vi.fn() }));
vi.mock('components/popovers/byeSchedulingPrompt', () => ({ promptByeScheduling: vi.fn() }));
vi.mock('components/tables/common/navigateToEvent', () => ({ navigateToEvent: vi.fn() }));
vi.mock('components/modals/selectParticipant', () => ({ selectParticipant: vi.fn() }));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: vi.fn() }));
vi.mock('components/popovers/tipster', () => ({ tipster: vi.fn() }));
vi.mock('courthive-components', () => ({ validators: {} }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

const { REMOVE_SEED, SEED_CASCADE } = positionActionConstants;
const { POLICY_TYPE_POSITION_ACTIONS } = policyConstants;
const removeSeedLabel = 'Remove seed';
const cascadeLabel = 'Withdraw seed (cascade)';

beforeEach(() => vi.clearAllMocks());

function openMenu(disabledActions: string[] = []) {
  const {
    drawIds: [drawId],
  } = mocksEngine.generateTournamentRecord({
    drawProfiles: [{ drawSize: 32, seedsCount: 8 }],
    nonRandom: 1,
    setState: true,
  });
  const { drawDefinition } = tournamentEngine.getEvent({ drawId });
  const structure = drawDefinition.structures[0];
  const participantId = structure.seedAssignments[0].participantId;
  const drawPosition = structure.positionAssignments.find(
    (assignment) => assignment.participantId === participantId,
  ).drawPosition;
  const { validActions = [] } = tournamentEngine.positionActions({
    drawId,
    structureId: structure.structureId,
    drawPosition,
    policyDefinitions: {
      [POLICY_TYPE_POSITION_ACTIONS]: { enabledStructures: [{ enabledActions: [], disabledActions }] },
    },
  });
  const callback = vi.fn();
  selectPositionAction({ actions: validActions, pointerEvent: { target: {} } as PointerEvent, callback });
  const menu = vi.mocked(tipster).mock.calls[0]?.[0] as any;
  return { actions: validActions, options: menu.options, callback };
}

it('offers seed-only removal beside withdrawal and sends its factory payload through mutationRequest', () => {
  const { actions, options, callback } = openMenu();
  const action = actions.find(({ type }) => type === REMOVE_SEED);
  expect(action).toBeDefined();
  expect(options.map(({ option }) => option)).toEqual(expect.arrayContaining([removeSeedLabel, cascadeLabel]));
  options.find(({ option }) => option === removeSeedLabel).onClick();
  expect(mutationRequest).toHaveBeenCalledTimes(1);
  const request: any = vi.mocked(mutationRequest).mock.calls[0][0];
  expect(request.methods).toEqual([{ method: action.method, params: action.payload }]);
  expect(callback).not.toHaveBeenCalled();
  request.callback({ success: true });
  expect(callback).toHaveBeenCalledTimes(1);
});

it('keeps the cascade action separate and dispatches its own draw-position payload', () => {
  const { actions, options, callback } = openMenu();
  const action = actions.find(({ type }) => type === SEED_CASCADE);
  expect(action).toBeDefined();
  options.find(({ option }) => option === cascadeLabel).onClick();
  const request: any = vi.mocked(mutationRequest).mock.calls[0][0];
  expect(request.methods).toEqual([{ method: action.method, params: action.payload }]);
  request.callback({ success: true, results: [] });
  expect(callback).toHaveBeenCalledTimes(1);
});

it('does not offer seed removal when the factory policy disables it', () => {
  const { actions, options } = openMenu([REMOVE_SEED]);
  expect(actions.some(({ type }) => type === REMOVE_SEED)).toBe(false);
  expect(options.some(({ option }) => option === removeSeedLabel)).toBe(false);
  expect(mutationRequest).not.toHaveBeenCalled();
});

/**
 * Add a voluntary consolation to a draw: the one path for the structure menu and the topology's Add playoffs chip.
 *
 * Leftover VOLUNTARY_CONSOLATION entries (from a consolation removed earlier) are purged first, then an empty
 * consolation is generated and attached. It stays empty until main-draw losers opt in.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { drawDefinitionConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

// constants
import { REMOVE_STAGE_ENTRIES, ATTACH_CONSOLATION_STRUCTURES } from 'constants/mutationConstants';

const { VOLUNTARY_CONSOLATION } = drawDefinitionConstants;

export function addVoluntaryConsolation({
  drawId,
  structureName = 'Consolation',
  callback,
}: {
  drawId: string;
  structureName?: string;
  /** Called with the new structure's id once it is attached. */
  callback?: (structureId: string) => void;
}): void {
  const create = () => {
    const genResult = tournamentEngine.generateVoluntaryConsolation({ structureName, drawId });
    if (genResult.error || !genResult.structures?.length) {
      console.error('[addVC] generateVoluntaryConsolation failed:', genResult.error || 'no structures');
      return;
    }
    const structureId = genResult.structures[0].structureId;
    mutationRequest({
      methods: [
        {
          method: ATTACH_CONSOLATION_STRUCTURES,
          params: { structures: genResult.structures, links: genResult.links, drawId },
        },
      ],
      callback: (result: any) => {
        if (result.success) callback?.(structureId);
      },
    });
  };

  const { drawDefinition } = tournamentEngine.getEvent({ drawId });
  const hasLeftoverEntries = drawDefinition?.entries?.some((e: any) => e.entryStage === VOLUNTARY_CONSOLATION);
  if (!hasLeftoverEntries) return create();

  mutationRequest({
    methods: [{ method: REMOVE_STAGE_ENTRIES, params: { drawId, entryStage: VOLUNTARY_CONSOLATION } }],
    callback: (result: any) => {
      if (result.success) create();
    },
  });
}

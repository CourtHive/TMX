import { describe, expect, it } from 'vitest';
import { getActionVisibility, ActionVisibilityParams } from './getActionVisibility';

const defaults: ActionVisibilityParams = {
  isMainStage: true,
  blockAssignment: false,
  isTeamEvent: false,
  hasUnassignedPositions: false,
  isEmptyDraw: false,
  hasDraft: false,
  hasQualifying: false,
  stageIsMain: true,
  stageSequence: 1,
  pdfPrinting: false,
  isDual: false,
};

const vis = (overrides: Partial<ActionVisibilityParams> = {}) => getActionVisibility({ ...defaults, ...overrides });

describe('getActionVisibility', () => {
  describe('assignParticipants', () => {
    it('visible for main stage without blocks', () => {
      expect(vis().assignParticipants).toBe(true);
    });

    it('hidden when not main stage', () => {
      expect(vis({ isMainStage: false }).assignParticipants).toBe(false);
    });

    it('hidden when assignment blocked by scores', () => {
      expect(vis({ blockAssignment: true }).assignParticipants).toBe(false);
    });

    it('hidden for TEAM events', () => {
      expect(vis({ isTeamEvent: true }).assignParticipants).toBe(false);
    });

    it('hidden when unassigned positions exist (button shown in control bar)', () => {
      expect(vis({ hasUnassignedPositions: true }).assignParticipants).toBe(false);
    });
  });

  describe('autoPlace', () => {
    it('visible for main stage with empty draw', () => {
      expect(vis({ isEmptyDraw: true }).autoPlace).toBe(true);
    });

    it('hidden when draw is not empty', () => {
      expect(vis({ isEmptyDraw: false }).autoPlace).toBe(false);
    });

    it('hidden when not main stage', () => {
      expect(vis({ isMainStage: false, isEmptyDraw: true }).autoPlace).toBe(false);
    });
  });

  describe('draft options', () => {
    it('both visible when draft exists', () => {
      let result: any = vis({ hasDraft: true });
      expect(result.configureDraft).toBe(true);
      expect(result.resolveDraft).toBe(true);
    });

    it('both hidden when no draft', () => {
      let result: any = vis({ hasDraft: false });
      expect(result.configureDraft).toBe(false);
      expect(result.resolveDraft).toBe(false);
    });
  });

  describe('editScorecard', () => {
    it('visible for TEAM events', () => {
      expect(vis({ isTeamEvent: true }).editScorecard).toBe(true);
    });

    it('hidden for non-TEAM events', () => {
      expect(vis({ isTeamEvent: false }).editScorecard).toBe(false);
    });
  });

  describe('removeStructure', () => {
    it('hidden for MAIN stage sequence 1 without qualifying', () => {
      expect(vis({ stageIsMain: true, stageSequence: 1, hasQualifying: false }).removeStructure).toBe(false);
    });

    it('visible for MAIN stage sequence 1 with qualifying', () => {
      expect(vis({ stageIsMain: true, stageSequence: 1, hasQualifying: true }).removeStructure).toBe(true);
    });

    it('visible for non-MAIN stage', () => {
      expect(vis({ stageIsMain: false, stageSequence: 1 }).removeStructure).toBe(true);
    });

    it('visible for sequence > 1', () => {
      expect(vis({ stageIsMain: true, stageSequence: 2 }).removeStructure).toBe(true);
    });
  });

  describe('printDraw', () => {
    it('visible when pdfPrinting enabled', () => {
      expect(vis({ pdfPrinting: true }).printDraw).toBe(true);
    });

    it('hidden when pdfPrinting disabled', () => {
      expect(vis({ pdfPrinting: false }).printDraw).toBe(false);
    });
  });

  describe('dual matchUp options', () => {
    it('removePlayers and clearResults visible for dual', () => {
      let result: any = vis({ isDual: true });
      expect(result.removePlayers).toBe(true);
      expect(result.clearResults).toBe(true);
    });

    it('removePlayers and clearResults hidden when not dual', () => {
      let result: any = vis({ isDual: false });
      expect(result.removePlayers).toBe(false);
      expect(result.clearResults).toBe(false);
    });
  });
});

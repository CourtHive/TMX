/**
 * Dev utility to complete all matchUps in the currently viewed structure.
 * Auto-detects drawId/structureId from the URL hash.
 * Uses mutationRequest so it works in client/server environments.
 * For elimination structures, loops until no more matchUps can be completed (with failsafe).
 * Stops at lucky draw boundaries (does not auto-resolve lucky loser selections).
 */
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import * as factory from 'tods-competition-factory';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';

function getHashSegment(name: string): string | undefined {
  const hash = globalThis.location.hash.replace('#/', '').split('/');
  const idx = hash.indexOf(name);
  return idx >= 0 ? hash[idx + 1] : undefined;
}

export function completeMatchUps({ drawId, structureId }: { drawId?: string; structureId?: string } = {}): void {
  const te = factory.tournamentEngine;

  // Auto-detect from current route: .../draw/:drawId/structure/:structureId
  if (!drawId) drawId = getHashSegment('draw');
  if (!structureId) structureId = getHashSegment('structure');

  if (!drawId) return console.log('No drawId — navigate to a draw view first');

  // Resolve structureId: fall back to first structure in draw when not in URL
  if (!structureId) {
    const eventData = te.getEventData({ drawId })?.eventData;
    const drawData = eventData?.drawsData?.find((d: any) => d.drawId === drawId);
    structureId = drawData?.structures?.[0]?.structureId;
    if (!structureId) return console.log('No structure found in draw');
  }

  // For CONTAINER structures (round robin), collect child structure IDs
  // since matchUps belong to child groups, not the container itself
  const { drawDefinition } = te.getEvent({ drawId });
  const structure = drawDefinition?.structures?.find((s: any) => s.structureId === structureId);
  const filterStructureIds = structure?.structures?.length
    ? structure.structures.map((s: any) => s.structureId)
    : [structureId];

  // Check if this is a lucky draw — stop before requiring lucky loser decisions
  const luckyStatus = te.getLuckyDrawRoundStatus({ drawId });
  const isLucky = luckyStatus?.isLuckyDraw;

  const getStructureMatchUps = () => {
    const result = te.allDrawMatchUps({ drawId, inContext: true }) || {};
    const all = result.matchUps || [];
    return all.filter((m: any) => !m.isCollectionMatchUp && filterStructureIds.includes(m.structureId));
  };

  const buildPassMethods = (): any[] => {
    const incomplete = getStructureMatchUps().filter(
      (m: any) => m.readyToScore && !m.winningSide && m.matchUpStatus !== 'BYE',
    );

    const methods: any[] = [];
    for (const m of incomplete) {
      const { outcome } = factory.mocksEngine.generateOutcome({
        matchUpFormat: m.matchUpFormat || drawDefinition?.matchUpFormat,
        matchUpStatusProfile: {},
        winningSide: 1,
      });
      if (!outcome) continue;

      methods.push({
        method: SET_MATCHUP_STATUS,
        params: {
          allowChangePropagation: true,
          matchUpId: m.matchUpId,
          drawId,
          outcome,
        },
      });
    }
    return methods;
  };

  // Check that all positions are assigned before attempting elimination looping
  const allStructureMatchUps = getStructureMatchUps();
  const isRoundRobin = allStructureMatchUps.some((m: any) => m.isRoundRobin);

  const MAX_PASSES = 20;
  let totalCompleted = 0;
  let pass = 0;

  const runPass = () => {
    const methods = buildPassMethods();
    if (!methods.length) {
      if (totalCompleted) {
        console.log(`Completed ${totalCompleted} matchUps`);
        reRenderCurrentView(drawId, structureId);
      } else {
        console.log('No incomplete matchUps with both participants');
      }
      return;
    }

    totalCompleted += methods.length;
    pass++;

    const shouldStop = isRoundRobin || pass >= MAX_PASSES || isLucky;

    mutationRequest({
      methods,
      callback: (result: any) => {
        if (!result?.success) {
          console.log('mutationRequest error:', result?.error);
          return;
        }

        if (isLucky) console.log('Lucky draw — stopping before lucky loser selection');

        if (shouldStop) {
          console.log(`Completed ${totalCompleted} matchUps`);
          reRenderCurrentView(drawId!, structureId!);
        } else {
          // Elimination: next pass after server ack
          runPass();
        }
      },
    });
  };

  runPass();
}

function reRenderCurrentView(drawId: string, structureId: string) {
  const eventId = getHashSegment('event');
  // Navigo won't re-trigger if the hash is unchanged, so force by
  // navigating away momentarily then back to the draw view.
  navigateToEvent({ eventId });
  navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
}

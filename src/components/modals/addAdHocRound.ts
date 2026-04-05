/**
 * Add ad-hoc round modal with automated drawMatic or manual generation.
 * Creates new round with optional dynamic ratings and participant selection.
 */
import { positionActionConstants, entryStatusConstants, drawDefinitionConstants, tournamentEngine, fixtures, factoryConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal, openModal } from './baseModal/baseModal';
import { renderForm } from 'courthive-components';
import { setActiveScale } from 'settings/setActiveScale';
import { selectParticipant } from './selectParticipant';
import { preferencesConfig } from 'config/preferencesConfig';
import { scalesMap } from 'config/scalesConfig';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { ADD_ADHOC_MATCHUPS, ADD_DRAW_ENTRIES, ADD_DYNAMIC_RATINGS } from 'constants/mutationConstants';
import { AUTOMATED, MANUAL } from 'constants/tmxConstants';

const { ASSIGN_PARTICIPANT } = positionActionConstants;
const { DIRECT_ACCEPTANCE } = entryStatusConstants;
const { VOLUNTARY_CONSOLATION } = drawDefinitionConstants;

const HELP_TEXT_STYLE =
  'display: none; font-size: 0.75em; line-height: 1.4; padding: 0.5em 0.7em; margin: 0.15em 0 0.4em;' +
  ' border-radius: 4px; background: var(--tmx-bg-secondary); color: var(--tmx-text-muted);';

function resolveLoserLinkParticipants(loserLinks: any[], structure: any, drawId: string | undefined): string[] {
  const sourceStructureId = structure.sourceStructureIds[0];
  const sourceRoundNumbers = new Set(loserLinks.map((l: any) => l.source?.roundNumber).filter(Boolean));
  const result = tournamentEngine.allDrawMatchUps({ drawId, inContext: true });
  const sourceMatchUps = (result?.matchUps || []).filter(
    (m: any) => m.structureId === sourceStructureId && m.winningSide && sourceRoundNumbers.has(m.roundNumber),
  );

  const ids: string[] = [];
  for (const m of sourceMatchUps) {
    const losingSide = m.sides?.find((_: any, i: number) => i + 1 !== m.winningSide);
    if (losingSide?.participantId) ids.push(losingSide.participantId);
  }
  return ids;
}

function resolvePositionLinkParticipants(positionLink: any, structure: any, drawId: string | undefined): string[] {
  const targetFinishingPositions = positionLink.source?.finishingPositions || [];
  const sourceStructureId = structure.sourceStructureIds[0];
  const { event: drawEvent } = tournamentEngine.getEvent({ drawId });
  const { eventData: evData } = tournamentEngine.getEventData({
    includePositionAssignments: true,
    eventId: drawEvent?.eventId,
  });
  const drawDataForParticipants = evData?.drawsData?.find((d: any) => d.drawId === drawId);
  const sourceStructure = drawDataForParticipants?.structures?.find(
    (s: any) => s.structureId === sourceStructureId,
  );

  const ids: string[] = [];
  const positionAssignments = sourceStructure?.positionAssignments || [];
  for (const pa of positionAssignments) {
    if (!pa.participantId) continue;
    const tally = pa.extensions?.find((e: any) => e.name === 'tally')?.value;
    const groupOrder = tally?.groupOrder || tally?.rankOrder;
    if (!targetFinishingPositions.length || (groupOrder && targetFinishingPositions.includes(groupOrder))) {
      ids.push(pa.participantId);
    }
  }
  return ids;
}

type AddAdHocRoundParams = {
  drawId?: string;
  structure?: any;
  structureId?: string;
  newRound?: boolean;
  callback?: (params: any) => void;
};

export function addAdHocRound({ drawId, structure, structureId, callback }: AddAdHocRoundParams = {}): void {
  structureId = structureId || structure?.structureId;
  let update: any, inputs: any;

  const matchUps =
    tournamentEngine.allDrawMatchUps({
      matchUpFilters: { structureIds: [structureId] },
      drawId,
    }).matchUps || [];

  const roundNumbers = matchUps.reduce((roundNumbers: number[], matchUp: any) => {
    const roundNumber = matchUp.roundNumber;
    if (roundNumber && !roundNumbers.includes(roundNumber)) roundNumbers.push(roundNumber);
    return roundNumbers;
  }, []);

  const lastRoundNumber = roundNumbers.at(-1);

  const maxRoundNumber = Math.max(...roundNumbers, 1);
  if (matchUps.length) roundNumbers.push(maxRoundNumber + 1);

  const addRound = ({ matchUps, roundResults }: any) => {
    const methods = [
      {
        params: { structureId, matchUps, drawId },
        method: ADD_ADHOC_MATCHUPS,
      },
    ];
    if (roundResults?.length) {
      for (const roundResult of roundResults) {
        const modifiedScaleValues = roundResult?.modifiedScaleValues;
        if (modifiedScaleValues && Object.keys(modifiedScaleValues).length) {
          (methods as any).push({
            params: { modifiedScaleValues, replacePriorValues: true },
            method: ADD_DYNAMIC_RATINGS,
          });
        }
      }
    }
    const postMutation = (result: any) => {
      if (result.success) {
        if (isFunction(callback) && callback) callback({ refresh: true });
      } else {
        console.log(result.error);
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const drawMaticRound = (participantIds: string[]) => {
    const selectedScale = inputs.levelOfPlay?.value || '';
    const { accessor: scaleAccessor, scaleName } = scalesMap[selectedScale] ?? {};
    setActiveScale(selectedScale);

    const useDynamicRatings = inputs.dynamicRatings?.checked ?? false;
    const teamAvoidance = inputs.teamAvoidance?.checked ?? false;
    const roundsCount = Number.parseInt(inputs.roundsCount?.value) || 1;

    const drawMaticParams = {
      updateParticipantRatings: true,
      dynamicRatings: useDynamicRatings,
      convertToELO: useDynamicRatings,
      refreshRatings: true,
      participantIds,
      scaleAccessor,
      roundsCount,
      scaleName,
      structureId,
      drawId,
      ...(teamAvoidance === false && { sameTeamValue: 0 }),
    };
    const result = tournamentEngine.drawMatic(drawMaticParams);
    if (!result.matchUps?.length) return;
    addRound(result);
  };

  const checkParticipants = ({
    participantIds,
    existingEntryIds,
  }: {
    participantIds: string[];
    existingEntryIds?: Set<string>;
  }) => {
    const participantsAvailable = tournamentEngine.getParticipants({
      participantFilters: { participantIds },
    }).participants;

    const lastRoundParticipantIds = lastRoundNumber
      ? matchUps
          .filter(
            ({ roundNumber, sides }: any) =>
              roundNumber === lastRoundNumber && sides?.some(({ participantId }: any) => participantId),
          )
          .flatMap(({ sides }: any) => sides.map(({ participantId }: any) => participantId))
      : [];

    const selectedParticipantIds = lastRoundParticipantIds.length ? lastRoundParticipantIds : participantIds;

    const action = {
      type: ASSIGN_PARTICIPANT,
      participantsAvailable,
    };

    const onSelection = (result: any) => {
      const selectedIds = result.selected?.map(({ participantId }: any) => participantId);
      if (!selectedIds?.length) return;

      // For VC, add entries for newly eligible players before generating the round
      const newEntryIds = existingEntryIds ? selectedIds.filter((id: string) => !existingEntryIds.has(id)) : [];
      if (newEntryIds.length) {
        mutationRequest({
          methods: [
            {
              method: ADD_DRAW_ENTRIES,
              params: {
                entryStatus: DIRECT_ACCEPTANCE,
                entryStage: VOLUNTARY_CONSOLATION,
                participantIds: newEntryIds,
                ignoreStageSpace: true,
                eventId: tournamentEngine.getEvent({ drawId })?.event?.eventId,
                drawId,
              },
            },
          ],
          callback: (entryResult: any) => {
            if (entryResult.success) drawMaticRound(selectedIds);
          },
        });
      } else {
        drawMaticRound(selectedIds);
      }
    };

    selectParticipant({
      title: t('modals.addRound.confirmSelection'),
      selectedParticipantIds,
      activeOnEnter: true,
      selectionLimit: 99,
      onSelection,
      action,
      update,
    });
  };

  const resolveLinkedParticipants = (): string[] => {
    const { drawDefinition } = tournamentEngine.getEvent({ drawId });
    const loserLinks = drawDefinition?.links?.filter(
      (link: any) => link.linkType === 'LOSER' && link.target?.structureId === structureId,
    );
    const positionLink = drawDefinition?.links?.find(
      (link: any) => link.linkType === 'POSITION' && link.target?.structureId === structureId,
    );

    if (loserLinks?.length) {
      return resolveLoserLinkParticipants(loserLinks, structure, drawId);
    }

    if (positionLink) {
      return resolvePositionLinkParticipants(positionLink, structure, drawId);
    }

    return [];
  };

  const resolveEntryParticipants = (): string[] => {
    const { drawDefinition } = tournamentEngine.getEvent({ drawId });
    return drawDefinition.entries
      .filter(
        ({ entryStatus, entryStage }: any) =>
          !['WITHDRAWN', 'UNGROUPED'].includes(entryStatus) && (!entryStage || entryStage === structure.stage),
      )
      .map(({ participantId }: any) => participantId);
  };

  const addMatchUps = () => {
    if (inputs[AUTOMATED].value === AUTOMATED) {
      let participantIds: string[];

      if (structure?.sourceStructureIds?.length) {
        participantIds = resolveLinkedParticipants();
      } else if (structure?.stage === VOLUNTARY_CONSOLATION) {
        const { drawDefinition } = tournamentEngine.getEvent({ drawId });
        const existingEntryIds = new Set<string>(
          drawDefinition.entries
            .filter(
              ({ entryStatus, entryStage }: any) =>
                !['WITHDRAWN', 'UNGROUPED'].includes(entryStatus) && entryStage === structure.stage,
            )
            .map(({ participantId }: any) => participantId),
        );
        const allIds = new Set(existingEntryIds);
        const eligible = tournamentEngine.getEligibleVoluntaryConsolationParticipants({ drawId });
        for (const p of eligible?.eligibleParticipants || []) allIds.add(p.participantId);
        checkParticipants({ participantIds: [...allIds], existingEntryIds });
        return;
      } else {
        participantIds = resolveEntryParticipants();
      }

      checkParticipants({ participantIds });
    } else {
      closeModal();
      const result = tournamentEngine.generateAdHocMatchUps({
        newRound: true,
        structureId,
        drawId,
      });

      if (!result.matchUps?.length) return;
      addRound(result);
    }
  };

  const buttons = [
    { label: t('common.cancel'), intent: 'none', close: true },
    { label: t('modals.addRound.addRound'), intent: 'is-success', close: false, onClick: addMatchUps },
  ];

  // Discover which ratings are present in the current tournament
  const { SINGLES } = factoryConstants.eventConstants;
  const { ratingsParameters } = fixtures;
  const { participants: allParticipants = [] } = tournamentEngine.getParticipants({ withScaleValues: true }) ?? {};
  const presentRatings = new Set<string>();
  for (const p of allParticipants) {
    for (const item of (p as any).ratings?.[SINGLES] || []) {
      presentRatings.add(item.scaleName);
    }
  }
  const activeRatingKeys = Object.keys(ratingsParameters).filter(
    (key) => !(ratingsParameters as any)[key].deprecated && presentRatings.has(key),
  );

  const hasRatings = activeRatingKeys.length > 0;

  const scaleOptions = [
    { label: `--${t('publishing.off')}--`, value: '', selected: !preferencesConfig.get().activeScale },
    ...activeRatingKeys.map((key) => ({
      label: key,
      value: key.toLowerCase(),
      selected: preferencesConfig.get().activeScale === key.toLowerCase(),
    })),
  ];

  const roundsCountOptions = [
    { label: '1', value: 1, selected: true },
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
    { label: '5', value: 5 },
  ];

  const helpIcon = '<span class="help-toggle" style="cursor: pointer; margin-left: 0.4em; color: var(--tmx-text-muted, #888)">\u24D8</span>';

  const options: any[] = [
    {
      field: AUTOMATED,
      value: AUTOMATED,
      options: [
        { label: AUTOMATED, value: AUTOMATED, selected: true },
        { label: MANUAL, value: false },
      ],
    },
    {
      label: `${t('modals.addRound.roundsCount')}`,
      field: 'roundsCount',
      options: roundsCountOptions,
    },
    {
      label: `${t('modals.addRound.levelOfPlay')} ${helpIcon}`,
      field: 'levelOfPlay',
      options: scaleOptions,
    },
    {
      text: `${t('modals.addRound.levelOfPlayHelp')}`,
      style: HELP_TEXT_STYLE,
    },
    {
      label: `${t('modals.addRound.dynamicRatings')} ${helpIcon}`,
      field: 'dynamicRatings',
      id: 'dynamicRatings',
      checkbox: true,
      checked: hasRatings,
    },
    {
      text: `${t('modals.addRound.dynamicRatingsHelp')}`,
      style: HELP_TEXT_STYLE,
    },
    {
      label: `${t('modals.addRound.teamAvoidance')} ${helpIcon}`,
      field: 'teamAvoidance',
      id: 'teamAvoidance',
      checkbox: true,
      checked: true,
    },
    {
      text: `${t('modals.addRound.teamAvoidanceHelp')}`,
      style: HELP_TEXT_STYLE,
    },
  ];

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, options);

    for (const toggle of elem.querySelectorAll('.help-toggle')) {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fieldDiv = (toggle as HTMLElement).closest('.field');
        const helpField = fieldDiv?.nextElementSibling as HTMLElement;
        if (helpField) {
          helpField.style.display = helpField.style.display === 'none' ? '' : 'none';
        }
      });
    }
  };

  update = (openModal as any)({ title: t('modals.addRound.title'), content, structure, buttons }).update;
}

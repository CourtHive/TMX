/**
 * Add ad-hoc round modal with automated drawMatic or manual generation.
 * Creates new round with optional dynamic ratings and participant selection.
 */
import { positionActionConstants, tournamentEngine, fixtures, factoryConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal, openModal } from './baseModal/baseModal';
import { renderForm } from 'courthive-components';
import { setActiveScale } from 'settings/setActiveScale';
import { selectParticipant } from './selectParticipant';
import { preferencesConfig } from 'config/preferencesConfig';
import { scalesMap } from 'config/scalesConfig';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { ADD_ADHOC_MATCHUPS, ADD_DYNAMIC_RATINGS } from 'constants/mutationConstants';
import { AUTOMATED, MANUAL } from 'constants/tmxConstants';

const { ASSIGN_PARTICIPANT } = positionActionConstants;

const HELP_TEXT_STYLE = 'color: var(--tmx-text-muted, #888); height: auto; padding: 0 0 0.4em 0; line-height: 1.3;';

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

  const lastRoundNumber = roundNumbers[roundNumbers.length - 1];

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

  const checkParticipants = ({ participantIds }: { participantIds: string[] }) => {
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
      const participantIds = result.selected?.map(({ participantId }: any) => participantId);
      drawMaticRound(participantIds);
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

  const addMatchUps = () => {
    if (inputs[AUTOMATED].value === AUTOMATED) {
      let participantIds: string[];

      if (structure?.stage === 'VOLUNTARY_CONSOLATION') {
        // For voluntary consolation, get eligible losers from the main structure
        const eligible = tournamentEngine.getEligibleVoluntaryConsolationParticipants({ drawId });
        participantIds = (eligible?.eligibleParticipants || []).map((p: any) => p.participantId);
      } else if (structure?.stage === 'PLAY_OFF' && structure?.sourceStructureIds?.length) {
        // For AD_HOC playoff structures, find participants from source RR groups
        // based on POSITION link finishingPositions
        const { drawDefinition } = tournamentEngine.getEvent({ drawId });
        const positionLink = drawDefinition?.links?.find(
          (link: any) => link.linkType === 'POSITION' && link.target?.structureId === structureId,
        );
        const targetFinishingPositions = positionLink?.source?.finishingPositions || [];

        // Get all participants from source structure's group results
        const sourceStructureId = structure.sourceStructureIds[0];
        const { event: drawEvent } = tournamentEngine.getEvent({ drawId });
        const { eventData: evData } = tournamentEngine.getEventData({
          includePositionAssignments: true,
          eventId: drawEvent?.eventId,
        });
        const drawDataForParticipants = evData?.drawsData?.find((d: any) => d.drawId === drawId);
        const sourceStructure = drawDataForParticipants?.structures?.find((s: any) => s.structureId === sourceStructureId);

        // Collect participants by their group finishing position (groupOrder from tally).
        // For CONTAINER (RR) structures, positionAssignments are flattened across all groups.
        participantIds = [];
        const positionAssignments = sourceStructure?.positionAssignments || [];
        for (const pa of positionAssignments) {
          if (!pa.participantId) continue;
          const tally = pa.extensions?.find((e: any) => e.name === 'tally')?.value;
          const groupOrder = tally?.groupOrder || tally?.rankOrder;
          // Include if no finishingPositions specified (all) or participant's position matches
          if (!targetFinishingPositions.length || (groupOrder && targetFinishingPositions.includes(groupOrder))) {
            participantIds.push(pa.participantId);
          }
        }
      } else {
        const { drawDefinition } = tournamentEngine.getEvent({ drawId });
        participantIds = drawDefinition.entries
          .filter(
            ({ entryStatus, entryStage }: any) =>
              !['WITHDRAWN', 'UNGROUPED'].includes(entryStatus) && (!entryStage || entryStage === structure.stage),
          )
          .map(({ participantId }: any) => participantId);
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

  const helpIcon = '\u24D8'; // circled i

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
      text: `<small>${t('modals.addRound.levelOfPlayHelp')}</small>`,
      style: HELP_TEXT_STYLE,
    },
    {
      label: `${t('modals.addRound.dynamicRatings')} ${helpIcon}`,
      field: 'dynamicRatings',
      checkbox: true,
      checked: hasRatings,
    },
    {
      text: `<small>${t('modals.addRound.dynamicRatingsHelp')}</small>`,
      style: HELP_TEXT_STYLE,
    },
    {
      label: `${t('modals.addRound.teamAvoidance')} ${helpIcon}`,
      field: 'teamAvoidance',
      checkbox: true,
      checked: true,
    },
    {
      text: `<small>${t('modals.addRound.teamAvoidanceHelp')}</small>`,
      style: HELP_TEXT_STYLE,
    },
  ];

  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options));

  update = (openModal as any)({ title: t('modals.addRound.title'), content, structure, buttons }).update;
}

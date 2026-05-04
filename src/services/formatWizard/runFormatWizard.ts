import { tournamentEngine } from 'tods-competition-factory';
import { extractParticipantRating } from './extractRating';

// constants and types
import {
  RankedPlan,
  RatingDistributionStats,
  WizardConstraints,
  WizardGovernance,
  WizardParticipant,
} from 'tods-competition-factory';

export interface RunFormatWizardArgs {
  constraints: WizardConstraints;
  governance?: WizardGovernance;
  scaleName: string;
  participantsOverride?: any[];
}

export interface RunFormatWizardResult {
  plans: RankedPlan[];
  distribution: RatingDistributionStats;
  appliedScale: string;
  totalParticipants: number;
  ratedParticipants: number;
  excludedParticipantIds: string[];
  error?: string;
}

const EMPTY_DISTRIBUTION: RatingDistributionStats = {
  histogram: [],
  count: 0,
  stddev: 0,
  median: 0,
  mean: 0,
  iqr: 0,
  min: 0,
  max: 0,
  gaps: [],
};

function emptyResult(scaleName: string, error?: string): RunFormatWizardResult {
  return {
    plans: [],
    distribution: EMPTY_DISTRIBUTION,
    appliedScale: scaleName,
    totalParticipants: 0,
    ratedParticipants: 0,
    excludedParticipantIds: [],
    error,
  };
}

// Pulls participants from the live tournamentEngine unless a caller
// supplies their own list (useful for tests and for dry-run "what
// if I added these people" flows in the future).
function readParticipants(participantsOverride: any[] | undefined): any[] {
  if (Array.isArray(participantsOverride)) return participantsOverride;
  const result: any = tournamentEngine.getParticipants?.({ withIndividualParticipants: true });
  return Array.isArray(result?.participants) ? result.participants : [];
}

// Bridge between TMX runtime context and the factory's Phase 1.A engine.
// Reads participants, resolves a single rating per participant against the
// supplied scale, drops the unrated, and calls
// `tournamentEngine.suggestFormatPlans` with the result. Returns the engine
// output plus TMX-side metadata (rated/excluded counts, applied scale).
export function runFormatWizard({
  participantsOverride,
  constraints,
  governance,
  scaleName,
}: RunFormatWizardArgs): RunFormatWizardResult {
  if (!constraints || typeof constraints.courts !== 'number' || typeof constraints.days !== 'number') {
    return emptyResult(scaleName, 'INVALID_CONSTRAINTS');
  }
  if (typeof scaleName !== 'string' || scaleName.length === 0) {
    return emptyResult(scaleName, 'MISSING_SCALE');
  }

  const allParticipants = readParticipants(participantsOverride);
  const totalParticipants = allParticipants.length;
  const wizardParticipants: WizardParticipant[] = [];
  const excludedParticipantIds: string[] = [];

  for (const participant of allParticipants) {
    const rating = extractParticipantRating(participant, scaleName);
    if (typeof rating === 'number') {
      wizardParticipants.push({
        participantId: participant.participantId,
        rating,
        gender: participant.person?.sex,
        category: participant.category,
      });
    } else if (participant?.participantId) {
      excludedParticipantIds.push(participant.participantId);
    }
  }

  if (wizardParticipants.length < 2) {
    return {
      plans: [],
      distribution: EMPTY_DISTRIBUTION,
      appliedScale: scaleName,
      totalParticipants,
      ratedParticipants: wizardParticipants.length,
      excludedParticipantIds,
      error: 'INSUFFICIENT_RATED_PARTICIPANTS',
    };
  }

  const result: any = tournamentEngine.suggestFormatPlans?.({
    participants: wizardParticipants,
    constraints,
    governance,
  });

  if (!result || result.error) {
    return {
      plans: [],
      distribution: result?.distribution ?? EMPTY_DISTRIBUTION,
      appliedScale: scaleName,
      totalParticipants,
      ratedParticipants: wizardParticipants.length,
      excludedParticipantIds,
      error: result?.error?.message ?? 'ENGINE_ERROR',
    };
  }

  return {
    plans: result.plans,
    distribution: result.distribution,
    appliedScale: scaleName,
    totalParticipants,
    ratedParticipants: wizardParticipants.length,
    excludedParticipantIds,
  };
}

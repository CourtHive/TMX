import { tournamentEngine, policyConstants } from 'tods-competition-factory';

const { POLICY_TYPE_AVOIDANCE } = policyConstants;

export function getAttachedAvoidances({ eventId, drawId }) {
  return tournamentEngine.getPolicyDefinitions({
    policyTypes: [POLICY_TYPE_AVOIDANCE],
    eventId,
    drawId
  })?.policyDefinitions?.[POLICY_TYPE_AVOIDANCE]?.policyAttributes;
}

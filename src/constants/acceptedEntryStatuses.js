import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';

const { ORGANISER_ACCEPTANCE, DIRECT_ACCEPTANCE, SPECIAL_EXEMPT, JUNIOR_EXEMPT, WILDCARD } = entryStatusConstants;
const { MAIN } = drawDefinitionConstants;

export const acceptedEntryStatuses = (stage = MAIN) => [
  `${stage}.${DIRECT_ACCEPTANCE}`,
  `${stage}.${ORGANISER_ACCEPTANCE}`,
  `${stage}.${SPECIAL_EXEMPT}`,
  `${stage}.${JUNIOR_EXEMPT}`,
  `${stage}.${WILDCARD}`
];

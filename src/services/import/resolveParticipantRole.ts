/**
 * Pure participant-role normalization. Used by `commitParticipantImport`
 * when an import row maps a "Role" column; extracted from
 * `applyParticipantRole` so the resolution contract can be unit-tested
 * without dragging in the surrounding mutationRequest plumbing.
 *
 * Match priority — the same priority `applyParticipantRole` originally
 * walked when this lived inline:
 *
 *   1. Exact factory role after upper-casing (e.g. `'COACH'`, `'coach'`,
 *      `'  Captain '` all hit the direct branch).
 *   2. Alias lookup against the alpha-only, lowercased form of the input
 *      (`'Assistant Coach'` -> `'assistantcoach'` -> COACH; `'Physio'` ->
 *      `'physio'` -> PHYSIO).
 *   3. Unknown -> `matched: false`. The caller decides whether to warn
 *      and / or default to COMPETITOR.
 *
 * `matched` lets the caller distinguish a deliberate COMPETITOR (`'player'`
 * -> COMPETITOR, matched=true) from the unknown-default fall-through
 * (`'sherpa'` -> matched=false). Both produce a usable role; only one
 * deserves a warning.
 */

export interface RoleResolution {
  /** The resolved factory `participantRole` constant. Always a valid factory
   *  role string; never undefined. Falls back to `'COMPETITOR'` when no
   *  match was found so the caller can still write something. */
  role: string;
  /** `true` when the input was directly recognised (factory role OR alias
   *  hit), `false` when it fell through to the default. Drives the
   *  caller's "did we recognise this?" decision (e.g. emit a warning). */
  matched: boolean;
}

/** Canonical factory `participantRole` constants. Hard-coded so the
 *  wizard stays decoupled from minor `tods-competition-factory` releases;
 *  sourced from `factory/src/constants/participantRoles.ts`. */
const VALID_PARTICIPANT_ROLES = new Set([
  'ADMINISTRATION',
  'CAPTAIN',
  'COACH',
  'COMPETITOR',
  'DIRECTOR',
  'HOSPITALITY',
  'MEDIA',
  'MEDICAL',
  'OFFICIAL',
  'OTHER',
  'PHYSIO',
  'SECURITY',
  'STRINGER',
  'SUPERVISOR',
  'TRAINER',
  'TRANSPORT',
  'VOLUNTEER',
]);

/** Natural-language -> factory-role aliases. Keys are the lowercased,
 *  alpha-only form of the input cell. */
const PARTICIPANT_ROLE_ALIASES: Record<string, string> = {
  // Player synonyms
  player: 'COMPETITOR',
  athlete: 'COMPETITOR',
  comp: 'COMPETITOR',
  // Coach synonyms
  coach: 'COACH',
  asstcoach: 'COACH',
  assistantcoach: 'COACH',
  headcoach: 'COACH',
  // Physio synonyms — distinct from MEDICAL (which stays for doctors /
  // on-call medical staff) per the factory role split landed alongside
  // the import wizard work.
  physio: 'PHYSIO',
  physiotherapist: 'PHYSIO',
  physicaltherapist: 'PHYSIO',
  pt: 'PHYSIO',
  // Trainer synonyms — strength-and-conditioning / athletic trainer.
  trainer: 'TRAINER',
  athletictrainer: 'TRAINER',
  at: 'TRAINER',
  strengthcoach: 'TRAINER',
  // Doctor / general medical staff
  doctor: 'MEDICAL',
  doc: 'MEDICAL',
  md: 'MEDICAL',
  medical: 'MEDICAL',
  med: 'MEDICAL',
  paramedic: 'MEDICAL',
  // Captain
  captain: 'CAPTAIN',
  capt: 'CAPTAIN',
};

const DEFAULT_ROLE = 'COMPETITOR';

export function resolveParticipantRole(raw: string | undefined | null): RoleResolution {
  if (raw == null) return { role: DEFAULT_ROLE, matched: false };
  const trimmed = raw.trim();
  if (!trimmed) return { role: DEFAULT_ROLE, matched: false };

  const upper = trimmed.toUpperCase();
  if (VALID_PARTICIPANT_ROLES.has(upper)) {
    return { role: upper, matched: true };
  }

  const normalized = trimmed.toLowerCase().replace(/[^a-z]/g, '');
  const aliased = PARTICIPANT_ROLE_ALIASES[normalized];
  if (aliased) {
    return { role: aliased, matched: true };
  }

  return { role: DEFAULT_ROLE, matched: false };
}

import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';

// constants and types
import { ConsolationAppetite, WizardConstraints } from 'tods-competition-factory';
import { ADD_TOURNAMENT_EXTENSION } from 'constants/mutationConstants';

export const FORMAT_WIZARD_EXTENSION_NAME = 'formatWizard';

// `_all` is the tournament-level scope (no event filter); per-event
// considerations key off the eventId. Each value is an array of
// plan fingerprints — see `services/formatWizard/planFingerprint.ts`.
export type ConsiderationMap = Record<string, string[]>;

export interface PersistedWizardState {
  scaleName: string;
  selectedEventId?: string;
  constraints: WizardConstraints;
  consideration?: ConsiderationMap;
  updatedAt?: string;
}

const APPETITE_VALUES: ConsolationAppetite[] = ['NONE', 'LIGHT', 'FULL'];

function isAppetite(value: unknown): value is ConsolationAppetite {
  return typeof value === 'string' && APPETITE_VALUES.includes(value as ConsolationAppetite);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// Defensive shape check — extension values can be anything that's
// ever been written into them. Returns the parsed state when the
// payload looks like a wizard state, otherwise undefined.
function parsePersistedState(value: unknown): PersistedWizardState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, any>;
  const c = v.constraints;
  if (!c || typeof c !== 'object') return undefined;
  if (!isFiniteNumber(c.courts) || !isFiniteNumber(c.days)) return undefined;
  if (typeof v.scaleName !== 'string' || v.scaleName.length === 0) return undefined;

  // Read legacy `minMatchesFloor` as a fallback so tournaments that
  // saved the wizard state under the old key continue to hydrate.
  const legacyTarget = isFiniteNumber(c.minMatchesFloor) ? c.minMatchesFloor : undefined;
  const constraints: WizardConstraints = {
    courts: c.courts,
    days: c.days,
    hoursPerDay: isFiniteNumber(c.hoursPerDay) ? c.hoursPerDay : undefined,
    avgMinutes: isFiniteNumber(c.avgMinutes) ? c.avgMinutes : undefined,
    targetMatchesPerPlayer: isFiniteNumber(c.targetMatchesPerPlayer) ? c.targetMatchesPerPlayer : legacyTarget,
    targetCompetitivePct: isFiniteNumber(c.targetCompetitivePct) ? c.targetCompetitivePct : undefined,
    voluntaryConsolation: typeof c.voluntaryConsolation === 'boolean' ? c.voluntaryConsolation : undefined,
    consolationAppetite: isAppetite(c.consolationAppetite) ? c.consolationAppetite : undefined,
    matchUpFormat: typeof c.matchUpFormat === 'string' ? c.matchUpFormat : undefined,
    allowMixedGender: typeof c.allowMixedGender === 'boolean' ? c.allowMixedGender : undefined,
    allowCollapsedCategories:
      typeof c.allowCollapsedCategories === 'boolean' ? c.allowCollapsedCategories : undefined,
  };

  const consideration = parseConsideration(v.consideration);

  return {
    scaleName: v.scaleName,
    selectedEventId: typeof v.selectedEventId === 'string' && v.selectedEventId.length > 0 ? v.selectedEventId : undefined,
    constraints,
    consideration,
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : undefined,
  };
}

function parseConsideration(value: unknown): ConsiderationMap | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const result: ConsiderationMap = {};
  for (const [key, list] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const stringList = list.filter((item): item is string => typeof item === 'string' && item.length > 0);
    if (stringList.length > 0) result[key] = stringList;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// Reads the persisted wizard state from the live tournament record's
// extensions. Returns undefined when no extension or the payload
// doesn't shape-check.
export function readWizardState(): PersistedWizardState | undefined {
  const tournamentRecord: any = tournamentEngine.getTournament?.()?.tournamentRecord;
  const extensions: any[] = tournamentRecord?.extensions ?? [];
  const ext = extensions.find((e: any) => e?.name === FORMAT_WIZARD_EXTENSION_NAME);
  return parsePersistedState(ext?.value);
}

// Writes the wizard state via mutationRequest. Returns the Promise
// from mutationRequest so callers can await persistence if needed.
export function writeWizardState(state: PersistedWizardState): void {
  const value = { ...state, updatedAt: new Date().toISOString() };
  mutationRequest({
    methods: [
      {
        method: ADD_TOURNAMENT_EXTENSION,
        params: { extension: { name: FORMAT_WIZARD_EXTENSION_NAME, value } },
      },
    ],
  });
}

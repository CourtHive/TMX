/**
 * One answer to "may this user do this here?", derived once and rendered
 * consistently.
 *
 * TMX has three independent sources of that answer and nothing that combines
 * them: provider configuration (`providerConfig`), the individual's roles
 * (`loginState`), and the tournament's own state. Each call site invents its
 * own combination, and they drift — the participants page gated its Officials
 * view on `canCreateOfficials` while the server enforced `canCreateCompetitors`
 * for both, so TMX offered a control the server then refused.
 *
 * The goal is not more gates. It is one answer.
 *
 * ## The result is not a boolean
 *
 * A disabled control that says *"Entries arrive through registration — accept a
 * registrant instead"* teaches the operating model. A hidden one reads as a bug,
 * and an enabled one that fails on save is the shape that caused the drift
 * above. So `can()` returns a reason, and `because` names the layer that said
 * no, which is what makes a support answer possible.
 *
 * ## Scope of this layer
 *
 * Provider + role only. Tournament state (lifecycle, registration window,
 * publication) and per-tournament scope are later phases — see
 * `Mentat/planning/TMX_LOCKDOWN_AND_ROLE_MODEL.md` §3. The `because` union
 * already carries their values so adding them is not a breaking change.
 *
 * ## This is a UX contract, not a security boundary
 *
 * Anything that must be *enforced* is enforced by the server
 * (`MutationAuthorizationService`, and the `MUTATION_PERMISSIONS` map both
 * layers share). `can()` decides what to render. Do not let its existence imply
 * otherwise.
 */
import { isPermittedOnResource } from 'services/capability/scopeState';
import { providerConfig } from 'config/providerConfig';
import { t } from 'i18n';

import type { ScopeTarget } from 'services/capability/scopeState';
import type { ProviderPermissions } from '@courthive/provider-config';

/** Which layer refused. Ordered most-specific-first, as the resolver evaluates. */
export type CapabilityLayer = 'tournamentState' | 'scope' | 'role' | 'provider';

export type Capability = { allowed: true } | { allowed: false; reason: string; because: CapabilityLayer };

/**
 * Actions TMX gates. Deliberately a closed set of *actions*, not a passthrough
 * of permission keys: the action is the vocabulary call sites should speak, and
 * it lets one action map to different keys as the model gains scope and state.
 */
export type CapabilityAction =
  | 'createCompetitor'
  | 'createOfficial'
  | 'importParticipants'
  | 'deleteParticipants'
  | 'editParticipantDetails'
  | 'modifyEntries'
  | 'createEvent'
  | 'deleteEvent'
  | 'createDraw'
  | 'deleteDraw'
  | 'assignPositions'
  | 'modifyStructures'
  | 'createVenue'
  | 'deleteVenue'
  | 'modifySchedule'
  | 'useBulkScheduling'
  | 'enterScores'
  | 'publish'
  | 'unpublish'
  | 'useChat';

const ACTION_PERMISSION: Readonly<Record<CapabilityAction, keyof ProviderPermissions>> = {
  createCompetitor: 'canCreateCompetitors',
  createOfficial: 'canCreateOfficials',
  importParticipants: 'canImportParticipants',
  deleteParticipants: 'canDeleteParticipants',
  editParticipantDetails: 'canEditParticipantDetails',
  modifyEntries: 'canModifyEntries',
  createEvent: 'canCreateEvents',
  deleteEvent: 'canDeleteEvents',
  createDraw: 'canCreateDraws',
  deleteDraw: 'canDeleteDraws',
  assignPositions: 'canAssignPositions',
  modifyStructures: 'canModifyStructures',
  createVenue: 'canCreateVenues',
  deleteVenue: 'canDeleteVenues',
  modifySchedule: 'canModifySchedule',
  useBulkScheduling: 'canUseBulkScheduling',
  enterScores: 'canEnterScores',
  publish: 'canPublish',
  unpublish: 'canUnpublish',
  useChat: 'canUseChat',
};

/** The permission key an action resolves to. Exported for the demo simulator. */
export function permissionForAction(action: CapabilityAction): keyof ProviderPermissions {
  return ACTION_PERMISSION[action];
}

const ALLOWED: Capability = { allowed: true };

/**
 * May the current user perform `action`?
 *
 * MUST be called at render, never cached at page load: a provider's effective
 * config is re-fetched on impersonation switch and a director's role can change
 * between renders. `navigation.ts` already re-evaluates its conditional tabs on
 * every tab render for exactly this reason.
 */
export function can(action: CapabilityAction): Capability {
  const key = ACTION_PERMISSION[action];

  if (!providerConfig.isAllowed(key)) {
    return {
      allowed: false,
      because: 'provider',
      reason: t(`capability.denied.${action}`, { defaultValue: t('capability.denied.provider') }),
    };
  }

  return ALLOWED;
}

/** Convenience for the `hide:` property that control-bar and menu items take. */
export function cannot(action: CapabilityAction): boolean {
  return !can(action).allowed;
}

/** The reason, when denied — otherwise undefined. Use for a disabled-control tooltip. */
export function denialReason(action: CapabilityAction): string | undefined {
  const result = can(action);
  return result.allowed ? undefined : result.reason;
}

/**
 * May the current user perform `action` **on this particular resource**?
 *
 * The scoped answer. `can()` asks whether the capability exists at all; this
 * additionally asks whether the user's grants reach this matchUp, court, day or
 * draw — the distinction a global boolean cannot make between scoring on
 * Court 7 and scoring the final on Centre.
 *
 * Scope is evaluated only after the unscoped layers pass, so the reason a user
 * sees is the most specific true one: "your provider does not allow scoring"
 * outranks "not on your court" when both hold.
 *
 * A subject holding no grants is unrestricted here, which makes this safe to
 * call everywhere — it is a no-op until someone is actually scoped.
 */
export function canForResource(action: CapabilityAction, resource: ScopeTarget): Capability {
  const unscoped = can(action);
  if (!unscoped.allowed) return unscoped;

  if (isPermittedOnResource(ACTION_PERMISSION[action], resource)) return ALLOWED;

  return {
    allowed: false,
    because: 'scope',
    reason: t('capability.outOfScope', { defaultValue: t('capability.denied.provider') }),
  };
}

/** Convenience for `hide:` / `disabled:` call sites that act on a resource. */
export function cannotForResource(action: CapabilityAction, resource: ScopeTarget): boolean {
  return !canForResource(action, resource).allowed;
}

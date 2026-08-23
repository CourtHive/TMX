/**
 * Demo-mode lockdown overlay — the store only. No DOM, no config imports, so
 * `providerConfig` can depend on this without a cycle.
 *
 * ## Intersect-only, by construction
 *
 * The overlay can REMOVE capability and can never GRANT it. `permissions` is
 * typed `Partial<Record<BooleanPermissionKey, false>>` so the rule is
 * unrepresentable to violate: a demo that granted something the live session
 * lacks would be showing a customer behaviour that does not exist for them,
 * which is the exact failure this feature is meant to prevent.
 *
 * ## sessionStorage, not localStorage
 *
 * A mid-demo reload is routine — dev-server restart, projector reconnect — so
 * the posture must survive F5. It must NOT survive the tab, or a demo posture
 * could be inherited by tomorrow's real session on a shared machine.
 */
import type { ProviderPermissions } from '@courthive/provider-config';

export type DemoPermissionOverride = Partial<Record<keyof ProviderPermissions, false>>;

export type DemoOverlay = {
  v: 1;
  /** Name of the preset the operator selected, or 'custom' once they tick a box. */
  preset?: string;
  permissions: DemoPermissionOverride;
};

const STORAGE_KEY = 'tmx_demo_overlay';

let overlay: DemoOverlay | undefined;
/** Bumped on every mutation so memoized consumers can invalidate cheaply. */
let version = 0;

function persist(): void {
  try {
    if (overlay) globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(overlay));
    else globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* sessionStorage unavailable (private mode / SSR) — the overlay still works in memory */
  }
}

/** Restore a posture across a reload. Safe to call more than once. */
export function hydrateDemoOverlay(): void {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.v === 1 && parsed.permissions && typeof parsed.permissions === 'object') {
      overlay = { v: 1, preset: parsed.preset, permissions: parsed.permissions };
      version += 1;
    }
  } catch {
    /* corrupt payload — ignore rather than trapping the operator in a broken posture */
  }
}

export function getDemoOverlay(): DemoOverlay | undefined {
  return overlay;
}

export function isDemoActive(): boolean {
  return !!overlay;
}

/** Monotonic counter for memoization keys. */
export function demoVersion(): number {
  return version;
}

export function setDemoOverlay(next: DemoOverlay | undefined): void {
  overlay = next;
  version += 1;
  persist();
}

/** Turn a single capability off (or back on) without disturbing the rest. */
export function setDemoPermission(key: keyof ProviderPermissions, allowed: boolean): void {
  const permissions: DemoPermissionOverride = { ...(overlay?.permissions ?? {}) };
  if (allowed) delete permissions[key];
  else permissions[key] = false;
  setDemoOverlay({ v: 1, preset: 'custom', permissions });
}

/** Leave demo mode entirely. */
export function clearDemoOverlay(): void {
  setDemoOverlay(undefined);
}

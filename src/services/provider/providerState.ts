/**
 * Active provider context with localStorage persistence.
 *
 * The persisted key is shared with the admin-client app so super-admins
 * can impersonate from /admin and have TMX pick up the selection on load.
 */
import { context } from 'services/context';

import type { ProviderValue } from 'types/tmx';

import { TMX_TOURNAMENTS } from 'constants/tmxConstants';

export const IMPERSONATED_PROVIDER_KEY = 'tmx_impersonated_provider';

export function setActiveProvider(provider: ProviderValue): void {
  context.provider = provider;
  try {
    globalThis.localStorage?.setItem(IMPERSONATED_PROVIDER_KEY, JSON.stringify(provider));
  } catch {
    /* localStorage unavailable (private mode / SSR) — non-fatal */
  }
  updateProviderBranding();
}

export function clearActiveProvider(): void {
  context.provider = undefined;
  try {
    globalThis.localStorage?.removeItem(IMPERSONATED_PROVIDER_KEY);
  } catch {
    /* non-fatal */
  }
  updateProviderBranding();
}

export function getActiveProvider(): ProviderValue | undefined {
  return context.provider;
}

export function readPersistedProvider(): ProviderValue | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(IMPERSONATED_PROVIDER_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.organisationId) return parsed as ProviderValue;
    return undefined;
  } catch {
    return undefined;
  }
}

function updateProviderBranding(): void {
  const el = document.getElementById('provider');
  const stopBtn = document.getElementById('h-stop-impersonating');
  const provider = context.provider;

  if (el) {
    if (provider?.organisationAbbreviation) {
      el.innerHTML = `<div style="font-size: .6em">${provider.organisationAbbreviation}</div>`;
      el.title = provider.organisationName ?? '';
    } else {
      el.innerHTML = `<div style="font-size: .6em">TMX</div>`;
      el.title = '';
    }
  }

  if (stopBtn) {
    if (provider?.organisationAbbreviation) {
      stopBtn.style.display = '';
      stopBtn.onclick = () => {
        clearActiveProvider();
        context.router?.navigate(`/${TMX_TOURNAMENTS}`);
      };
    } else {
      stopBtn.style.display = 'none';
      stopBtn.onclick = null;
    }
  }
}

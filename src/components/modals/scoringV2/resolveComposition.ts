/**
 * Resolves composition settings for scoring modal
 * Priority: drawDefinition extension > env.composition > localStorage > default
 * Smart Complements: localStorage settings > env > default
 */
import { tournamentEngine, extensionConstants } from 'tods-competition-factory';
import { loadSettings } from 'services/settings/settingsStorage';
import { env } from 'settings/env';

export interface CompositionSettings {
  compositionName: string;
  smartComplements?: boolean;
}

/**
 * Resolves smartComplements setting from localStorage or env
 * @returns Smart complements preference
 */
function resolveSmartComplements(): boolean {
  // Priority 1: localStorage settings
  const settings = loadSettings();
  if (settings?.smartComplements !== undefined) {
    return settings.smartComplements;
  }

  // Priority 2: env setting
  if (env.smartComplements !== undefined) {
    return env.smartComplements;
  }

  // Default: false
  return false;
}

/**
 * Resolves composition settings from multiple sources
 * @param matchUp - The matchUp being scored (contains drawId)
 * @returns Composition settings for courthive-components
 */
export function resolveComposition(matchUp: any): CompositionSettings {
  const defaultSettings: CompositionSettings = {
    compositionName: 'Australian',
    smartComplements: false,
  };

  // Resolve smartComplements independently (from localStorage or env)
  const smartComplements = resolveSmartComplements();

  // Try to get composition from drawDefinition extension
  if (matchUp?.drawId) {
    try {
      const result = tournamentEngine.findExtension({
        name: extensionConstants.DISPLAY,
        discover: true,
        drawId: matchUp.drawId,
      });

      if (result?.extension?.value?.compositionName) {
        return {
          compositionName: result.extension.value.compositionName,
          smartComplements,
        };
      }
    } catch (err) {
      console.warn('Failed to resolve composition from draw extension:', err);
    }
  }

  // Fall back to env.composition
  if (env.composition?.compositionName) {
    return {
      compositionName: env.composition.compositionName,
      smartComplements,
    };
  }

  // Fall back to localStorage
  try {
    const stored = localStorage.getItem('tmx_composition');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.compositionName) {
        return {
          compositionName: parsed.compositionName,
          smartComplements,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse composition from localStorage:', err);
  }

  // Return default with resolved smartComplements
  return {
    ...defaultSettings,
    smartComplements,
  };
}

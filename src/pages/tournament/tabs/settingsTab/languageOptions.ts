/**
 * Options for the Settings language picker.
 *
 * Extracted from `settingsGrid` so the matching rule is testable without a DOM. The rule is the
 * whole point of this module: `i18next.language` is whatever was passed to `changeLanguage`, and
 * `resolveBootLanguage` passes `navigator.language` — which is region-tagged on most browsers
 * (`en-US`, not `en`). Translations still resolve through `fallbackLng`, so the UI reads correctly
 * and nothing appears wrong, but an exact-equality match against the locale manifest finds nothing.
 *
 * A `<select>` with no selected option displays its first one. The manifest is alphabetical, so that
 * was `ar` — and because `persistAll` reads the control's value on every save, changing an unrelated
 * setting persisted Arabic as an explicit user choice and reloaded the app into it.
 */

/** Hardcoded display label for the bundled / always-present `en` locale. */
const FALLBACK_LANGUAGES: Record<string, string> = {
  en: 'English',
};

const DEFAULT_LANGUAGE = 'en';

export interface LanguageOption {
  value: string;
  label: string;
  selected: boolean;
}

export interface ManifestLocale {
  code: string;
  label?: string;
  nativeLabel?: string;
}

/** `'en-US'` → `'en'`; `'en'` → `'en'`. Also tolerates the underscore form some platforms emit. */
function baseLanguage(code: string): string {
  return code.split(/[-_]/)[0].toLowerCase();
}

/**
 * The available code that best represents `current`, or undefined when nothing fits.
 *
 * Exact match wins so a genuinely region-specific locale (`pt-BR`, `zh-CN`) keeps its identity.
 * Otherwise the base language matches, which is what rescues `en-US` → `en`. `en` is the last
 * resort because it is the bundled locale and what `fallbackLng` would have rendered anyway —
 * returning nothing here is what let the control fall through to its first option.
 */
export function resolveCurrentLanguageCode(available: string[], current?: string): string | undefined {
  if (!available.length) return undefined;

  if (current) {
    const exact = available.find((code) => code === current);
    if (exact) return exact;

    const base = baseLanguage(current);
    const byBase = available.find((code) => baseLanguage(code) === base);
    if (byBase) return byBase;
  }

  return available.find((code) => code === DEFAULT_LANGUAGE);
}

/**
 * Build the option list for the language control. Prefers the manifest's native labels (e.g.
 * "Čeština") — the most self-evident way to recognise your own language in a settings list.
 *
 * Exactly one option is selected whenever the resolver can place the current language, so the
 * control always opens on what the interface is actually rendering.
 */
export function buildLanguageOptions(
  manifestLocales: ManifestLocale[] | undefined,
  knownInI18next: Set<string>,
  currentLanguage: string | undefined,
): LanguageOption[] {
  const seen = new Set<string>();
  const out: Array<Omit<LanguageOption, 'selected'>> = [];

  // Manifest is the primary source.
  for (const entry of manifestLocales ?? []) {
    if (seen.has(entry.code)) continue;
    seen.add(entry.code);
    out.push({ value: entry.code, label: entry.nativeLabel || entry.label || entry.code });
  }

  // Backstop: any locale i18next has loaded that wasn't in the manifest (e.g. CFS unreachable, but a
  // prior session fetched the file and it's still in memory). Include them so the user can keep
  // using them.
  for (const code of knownInI18next) {
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ value: code, label: FALLBACK_LANGUAGES[code] || code });
  }

  const resolved = resolveCurrentLanguageCode(
    out.map((option) => option.value),
    currentLanguage,
  );

  return out.map((option) => ({ ...option, selected: option.value === resolved }));
}

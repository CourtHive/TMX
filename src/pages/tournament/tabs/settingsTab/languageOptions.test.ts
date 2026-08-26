import { describe, expect, it } from 'vitest';

import { buildLanguageOptions, resolveCurrentLanguageCode } from './languageOptions';

/** The live CFS manifest, in the order it is served (alphabetical — which is why `ar` is first). */
const MANIFEST = [
  { code: 'ar', nativeLabel: 'العربية' },
  { code: 'cs', nativeLabel: 'Čeština' },
  { code: 'de', nativeLabel: 'Deutsch' },
  { code: 'en', nativeLabel: 'English' },
  { code: 'es', nativeLabel: 'Español' },
  { code: 'fr', nativeLabel: 'Français' },
  { code: 'hr', nativeLabel: 'Hrvatski' },
  { code: 'pt-BR', nativeLabel: 'Português (Brasil)' },
  { code: 'zh-CN', nativeLabel: '简体中文' },
];

const BUNDLED = new Set(['en']);

const selectedValue = (options: Array<{ value: string; selected: boolean }>) =>
  options.find((option) => option.selected)?.value;

/**
 * Reported by CA: Settings opened showing Arabic, and changing any unrelated setting switched the
 * whole interface to it.
 *
 * `resolveBootLanguage` passes `navigator.language` to `changeLanguage`, so `i18next.language` is
 * region-tagged (`en-US`). Translations still resolve through `fallbackLng: 'en'`, so the UI reads
 * English and nothing looks wrong — but no manifest code equals `en-US`, so nothing was marked
 * selected and the `<select>` fell through to its first option.
 */
describe('buildLanguageOptions', () => {
  it('selects English when the browser reports a region-tagged en-US', () => {
    const options = buildLanguageOptions(MANIFEST, BUNDLED, 'en-US');
    expect(selectedValue(options)).toBe('en');
    // the regression: nothing selected, so the control displayed options[0]
    expect(options[0].value).toBe('ar');
    expect(options[0].selected).toBe(false);
  });

  it('marks exactly one option selected', () => {
    for (const current of ['en-US', 'en', 'fr-FR', 'pt-BR', 'cs', undefined]) {
      const options = buildLanguageOptions(MANIFEST, BUNDLED, current);
      expect(options.filter((option) => option.selected)).toHaveLength(1);
    }
  });

  it('keeps a genuinely region-specific locale rather than collapsing it to its base', () => {
    expect(selectedValue(buildLanguageOptions(MANIFEST, BUNDLED, 'pt-BR'))).toBe('pt-BR');
    expect(selectedValue(buildLanguageOptions(MANIFEST, BUNDLED, 'zh-CN'))).toBe('zh-CN');
  });

  it('falls back to the base language for any other region tag', () => {
    expect(selectedValue(buildLanguageOptions(MANIFEST, BUNDLED, 'fr-CA'))).toBe('fr');
    expect(selectedValue(buildLanguageOptions(MANIFEST, BUNDLED, 'de-AT'))).toBe('de');
    // a Brazilian build of Portuguese asked for generically still lands somewhere sensible
    expect(selectedValue(buildLanguageOptions(MANIFEST, BUNDLED, 'pt'))).toBe('pt-BR');
  });

  it('falls back to English for a language that is not offered at all', () => {
    expect(selectedValue(buildLanguageOptions(MANIFEST, BUNDLED, 'ja-JP'))).toBe('en');
  });

  it('prefers the native label so a speaker can recognise their own language', () => {
    const options = buildLanguageOptions(MANIFEST, BUNDLED, 'en');
    expect(options.find((option) => option.value === 'cs')?.label).toBe('Čeština');
  });

  it('still offers locales i18next holds when the manifest is unreachable', () => {
    const options = buildLanguageOptions(undefined, new Set(['en', 'cs']), 'en-US');
    expect(options.map((option) => option.value).sort((a, b) => a.localeCompare(b, 'en'))).toEqual(['cs', 'en']);
    expect(selectedValue(options)).toBe('en');
  });

  it('returns nothing to select when there is nothing to offer', () => {
    expect(buildLanguageOptions(undefined, new Set(), 'en-US')).toEqual([]);
  });
});

describe('resolveCurrentLanguageCode', () => {
  const AVAILABLE = MANIFEST.map((entry) => entry.code);

  it('prefers an exact match over the base language', () => {
    expect(resolveCurrentLanguageCode(AVAILABLE, 'pt-BR')).toBe('pt-BR');
  });

  it('tolerates the underscore form some platforms emit', () => {
    expect(resolveCurrentLanguageCode(AVAILABLE, 'en_GB')).toBe('en');
  });

  it('is case-insensitive on the base language', () => {
    expect(resolveCurrentLanguageCode(AVAILABLE, 'FR-fr')).toBe('fr');
  });

  it('answers undefined when nothing fits and English is not on offer', () => {
    expect(resolveCurrentLanguageCode(['ar', 'cs'], 'ja-JP')).toBeUndefined();
    expect(resolveCurrentLanguageCode([], 'en')).toBeUndefined();
  });

  it('handles a missing current language by falling back to English', () => {
    expect(resolveCurrentLanguageCode(AVAILABLE, undefined)).toBe('en');
  });
});

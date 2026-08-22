/**
 * `.tmx-role-badge` markup lives in exactly one place now. Three inline copies previously drifted, and
 * the class they emitted had no CSS at all — the journey covering it asserted text content only, so it
 * passed against an unstyled badge for as long as it existed.
 *
 * The OTHER-handling asymmetry between call sites is deliberate and is asserted here so a future
 * "cleanup" does not unify it: `getGroupingsColumns` blanks OTHER (it is the neutral default every GROUP
 * starts with, so badging it marks every row), while the Staff view shows it (it is the role that person
 * actually holds, and blanking it would leave their Role cell empty).
 */
import { roleBadge, roleBadgeFormatter } from './roleBadge';
import { describe, expect, it } from 'vitest';

describe('roleBadge', () => {
  it('emits the shared class, never inline colour', () => {
    const html = roleBadge('COACH');
    expect(html).toEqual('<span class="tmx-role-badge">COACH</span>');
    // The previous inline copies built their background by appending alpha digits onto a var()
    // substitution, which does not compose. Nothing here may carry style.
    expect(html).not.toContain('style=');
  });

  it('renders nothing for an absent role', () => {
    expect(roleBadge()).toEqual('');
    expect(roleBadge('')).toEqual('');
  });

  it('does NOT special-case OTHER — that is the caller’s decision', () => {
    expect(roleBadge('OTHER')).toEqual('<span class="tmx-role-badge">OTHER</span>');
  });

  it('formatter reads through the Tabulator cell', () => {
    expect(roleBadgeFormatter({ getValue: () => 'PHYSIO' })).toEqual('<span class="tmx-role-badge">PHYSIO</span>');
    expect(roleBadgeFormatter({ getValue: () => undefined })).toEqual('');
  });
});

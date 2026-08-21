/**
 * The single renderer for a `participantRole` badge. `.tmx-role-badge` is defined once in `tmx.css`
 * with light and dark tokens; three inline copies previously drifted, two of them building their
 * background by appending alpha digits onto a `var()` substitution.
 *
 * Deliberately does NOT special-case `OTHER`. The two existing call sites disagree about it, and the
 * disagreement is correct: on a GROUP row `OTHER` is the neutral default every group starts with, so
 * badging it would mark every row and leave none meaningful — `getGroupingsColumns` blanks it before
 * calling. On an individual in the Staff view `OTHER` is the role that person actually holds, and
 * hiding it would leave the Role column empty for them. Callers decide; this only renders.
 */
export function roleBadge(role?: string): string {
  if (!role) return '';
  return `<span class="tmx-role-badge">${role}</span>`;
}

/** Tabulator cell formatter wrapping {@link roleBadge}. */
export function roleBadgeFormatter(cell: any): string {
  return roleBadge(cell.getValue());
}

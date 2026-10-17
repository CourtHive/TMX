const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes a value for interpolation into HTML text or a quoted attribute.
 *
 * Record data — tournament, event, draw, structure, venue, court and participant names, addresses,
 * notes — arrives from CFS, other clients, provider-key integrators and imported files, so it must
 * never be parsed as markup. Prefer `textContent` where an element holds only the value; use this
 * where the value sits inside an HTML template, or in a label/title that a component writes with
 * innerHTML (courthive-components dropdown, selectItem, form and control-bar labels are HTML by
 * contract). i18next runs with `escapeValue: false`, so a `t()` string interpolating record data is
 * HTML too: escape the interpolated value.
 */
export function escapeHtml(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

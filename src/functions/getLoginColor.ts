/**
 * Compute the login icon color based on auth state.
 * Returns a CSS variable string or empty string for default color. The icon sits in the navbar, so the
 * colors are the palette's chrome roles, which hold 3:1 against the chrome background.
 */
export function getLoginColor({
  valid,
  impersonating,
  isSuperAdmin,
}: {
  valid: boolean;
  impersonating: boolean;
  isSuperAdmin: boolean;
}): string {
  if (!valid) return '';
  if (impersonating) return 'var(--tmx-chrome-danger)';
  if (isSuperAdmin) return 'var(--tmx-chrome-success)';
  return 'var(--tmx-chrome-active)';
}

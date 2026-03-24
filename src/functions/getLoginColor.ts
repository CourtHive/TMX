/**
 * Compute the login icon color based on auth state.
 * Returns a CSS variable string or empty string for default color.
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
  if (impersonating) return 'var(--tmx-accent-red)';
  if (isSuperAdmin) return 'var(--tmx-accent-green)';
  return 'var(--tmx-accent-blue)';
}

export function getJwtTokenStorageKey(): string {
  const TOKEN_NAME = process.env.REACT_TMX_TOKEN_NAME || 'tmxToken';
  if (!TOKEN_NAME) throw new Error('Token storage name not defined!');

  return TOKEN_NAME;
}

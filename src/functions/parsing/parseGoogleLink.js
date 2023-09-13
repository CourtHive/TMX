export function parseGoogleLink(link) {
  const parts = link.split('/');
  const ll = parts.reduce((p, c) => (c && c[0] === '@' ? c : p), undefined);
  const lparts = ll?.split(',');
  const latitude = lparts?.[0].slice(1);
  const longitude = lparts?.[1];

  return { latitude, longitude };
}

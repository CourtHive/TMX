export function percentSorter(a, b) {
  if (!a && !b) return -1;
  if (a && !b) return -1;
  if (b && !a) return 1;
  return b - a;
}

export function competitiveProfileSorter(a, b) {
  if (a.pctSpread && !b.pctSpread) return -1;
  if (b.pctSpread && !a.pctSpread) return 1;
  if (!a.pctSpread && !b.pctSpread) return 0;
  return b.pctSpread - a.pctSpread;
}

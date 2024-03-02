export function scoreSorter(a, b) {
  if (!a.score && !b.score) {
    if (a.readyToScore && !b.readyToScore) return -1;
    if (b.readyToScore && !a.readyToScore) return 1;
  }
  if (a.score && !b.score) return -1;
  if (b.score && !a.score) return 1;
  return 0;
}

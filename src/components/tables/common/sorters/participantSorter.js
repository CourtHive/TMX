export function participantSorter(a, b) {
  const personA = a?.person || a?.participant?.person;
  const personB = b?.person || b?.participant?.person;
  if (personA || personB) {
    if (personA?.standardFamilyName && !personB?.standardFamilyName) return 1;
    if (personB?.standardFamilyName && !personA?.standardFamilyName) return 1;
    if (!personA?.standardFamilyName && !personB?.standardFamilyName) return 1;
    return personA.standardFamilyName?.localeCompare(personB?.standardFamilyName);
  }
  if (a.participantName && !b.participantName) return 1;
  if (b.participantName && !a.participantName) return 1;
  if (!a?.participantName && !b?.participantName) return 1;
  return a?.participantName?.localeCompare(b?.participantName);
}

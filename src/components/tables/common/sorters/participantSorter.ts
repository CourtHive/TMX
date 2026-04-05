function getSortName(item) {
  const person = item?.person || item?.participant?.person;
  return person?.standardFamilyName || item?.participantOtherName || item?.participant?.participantOtherName || item?.participantName || item?.participant?.participantName || '';
}

export function participantSorter(a, b) {
  const nameA = getSortName(a);
  const nameB = getSortName(b);
  return nameA.localeCompare(nameB);
}

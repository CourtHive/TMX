export function roundGroupingHeader(value, count, data, group) {
  //value - the value all members of this group share
  //count - the number of rows in this group
  //data - an array of all the row data objects in this group
  //group - the group component for the group

  !!(data && group);
  const itemDisplay = count > 1 ? 'items' : 'item';

  return value + `<span style='color:blue; margin-left:10px;'>(${count} ${itemDisplay})</span>`;
}

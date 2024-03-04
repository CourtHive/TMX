export const headerSortElement = (exclude) => (column, dir) => {
  const def = column.getDefinition();
  if (exclude.includes(def.field)) return '';

  return (
    (dir === 'asc' && "<div><i class='fas fa-sort-up'></div>") ||
    (dir === 'desc' && "<div><i class=' fas fa-sort-down'></div>") ||
    "<div><i class='fas fa-sort'></div>"
  );
};

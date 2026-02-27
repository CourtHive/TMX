export const visiblityFormatter = (cell: any): string => {
  const row = cell.getRow().getData();
  const published = cell.getValue();
  if (published && row.embargoActive) {
    return '<i class="fa-solid fa-clock" style="color: var(--tmx-accent-orange)">';
  }
  return published
    ? '<i class="fa-solid fa-eye" style="color: var(--tmx-accent-blue)">'
    : '<i class="fa-solid fa-eye-slash" style="color: var(--tmx-accent-red)">';
};

export const visiblityFormatter = (cell: any): string => {
  const published = cell.getValue();
  return published
    ? '<i class="fa-solid fa-eye" style="color: var(--tmx-accent-blue)">'
    : '<i class="fa-solid fa-eye-slash" style="color: var(--tmx-accent-red)">';
};

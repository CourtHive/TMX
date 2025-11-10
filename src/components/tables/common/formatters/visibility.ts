export const visiblityFormatter = (cell: any): string => {
  const published = cell.getValue();
  return published
    ? '<i class="fa-solid fa-eye" style="color: blue">'
    : '<i class="fa-solid fa-eye-slash" style="color: red">';
};

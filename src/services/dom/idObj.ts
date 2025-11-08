type IdObject = {
  [key: string]: {
    id: string;
    element: HTMLElement | null;
  };
};

export function idObj(ids: Record<string, string>): IdObject {
  return Object.assign(
    {},
    ...Object.keys(ids).map((id) => ({
      [id]: { id: ids[id], element: document.getElementById(ids[id]) }
    }))
  );
}

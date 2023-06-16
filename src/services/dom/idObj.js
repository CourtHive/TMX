// idObj() returns unique element ids and element references so that calling
// functions can bind events (onclick) and pass ids to other components
export function idObj(ids) {
  return Object.assign(
    {},
    ...Object.keys(ids).map((id) => ({
      [id]: { id: ids[id], element: document.getElementById(ids[id]) }
    }))
  );
}

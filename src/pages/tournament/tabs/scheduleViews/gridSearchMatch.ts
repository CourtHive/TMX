/**
 * Schedule2 — how the court grid decides whether a cell matches a search.
 *
 * Pure, and separate from `gridView.ts` so the rule can be tested without
 * rendering a grid: the same split `participantRest.ts` / `inspectorRest.ts`
 * already uses in this directory. Nothing here touches a DOM global — the walk
 * reads only the node it is handed — so the unit suite (which runs in node, with
 * no jsdom) can exercise it.
 */

/** `Node.TEXT_NODE`, spelled out because `Node` is not defined in the node suite. */
const TEXT_NODE = 3;

/** The subset of a DOM node this module reads. */
type TextBearingNode = {
  nodeType: number;
  nodeValue: string | null;
  childNodes: ArrayLike<TextBearingNode>;
};

/**
 * One string, comparable: lower-cased, every whitespace run collapsed to a single
 * space, ends trimmed. Applied to BOTH sides of the search so they cannot
 * disagree about spacing.
 */
export function searchNormalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * A cell's visible text as one searchable line.
 *
 * `textContent` got two things wrong here. It concatenates elements with no
 * separator, so the round label ran straight into the first name — the haystack
 * read `"R32Michael  Livsonvs.Tin Chen"` — and no query spanning one of those
 * seams could ever match. And it reproduces stored whitespace verbatim, which the
 * browser then collapses when it paints: a participant stored as
 * `'Michael  Livson'` reads "Michael Livson" on screen and did not match a search
 * for exactly what was on screen.
 *
 * That double space is a real defect, now fixed at the write boundaries — in the
 * participant edit form and in the factory's `addParticipant`/`modifyParticipant`.
 * Records already carrying it still have to be findable, though, and normalizing
 * on read is what keeps them so without a data migration.
 */
export function cellSearchText(el: TextBearingNode): string {
  const parts: string[] = [];
  const visit = (node: TextBearingNode): void => {
    if (node.nodeType === TEXT_NODE) {
      const value = node.nodeValue ?? '';
      if (value.trim()) parts.push(value);
      return;
    }
    for (let i = 0; i < node.childNodes.length; i++) visit(node.childNodes[i]);
  };
  visit(el);
  return searchNormalize(parts.join(' '));
}

/** Whether `el`'s text contains `needle`, both sides normalized. */
export function cellMatchesSearch(el: TextBearingNode, needle: string): boolean {
  const normalized = searchNormalize(needle);
  return !!normalized && cellSearchText(el).includes(normalized);
}

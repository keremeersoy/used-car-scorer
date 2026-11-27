const BLOCKS = new Set([
  'P',
  'DIV',
  'LI',
  'UL',
  'OL',
  'TABLE',
  'TR',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
]);
const SKIPPED = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);

/**
 * The description as plain text, one line per line break or block. Plain textContent would glue
 * words across breaks and hide warning phrases.
 */
export function description(doc: Document): string | null {
  const root = doc.querySelector('#classifiedDescription');
  if (!root) return null;
  let text = '';
  const walk = (node: Node) => {
    if (node.nodeType === 3 /* text */) {
      // Line breaks in the file itself are just spacing.
      text += node.textContent!.replace(/\s+/g, ' ');
      return;
    }
    const name = node.nodeName;
    if (SKIPPED.has(name)) return;
    if (name === 'BR') {
      text += '\n';
      return;
    }
    const block = BLOCKS.has(name);
    if (block) text += '\n';
    node.childNodes.forEach(walk);
    if (block) text += '\n';
  };
  walk(root);
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return lines.join('\n') || null;
}

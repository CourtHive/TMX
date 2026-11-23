const APPROVED_FETCH = ['/src/serviceWorker.ts', '/src/services/pdf/pdfFont.ts'];
const BOUNDARY = '/src/services/network/serverNetwork.ts';

export const networkBoundaries = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      primitive:
        'Create server traffic through services/network/serverNetwork. Raw network primitives bypass sandbox isolation.',
    },
  },
  create(context) {
    const file = '/' + context.filename.replaceAll('\\', '/');
    const approved = file.endsWith(BOUNDARY);
    const staticFetch = APPROVED_FETCH.some((suffix) => file.endsWith(suffix));
    const name = (node) => node?.name ?? node?.value;
    const report = (node) => context.report({ node, messageId: 'primitive' });
    return {
      ImportDeclaration(node) {
        if (approved || !/^(?:axios|socket\.io-client)(?:\/|$)/.test(node.source.value)) return;
        if (node.importKind === 'type' || node.specifiers.every((specifier) => specifier.importKind === 'type')) return;
        report(node);
      },
      ImportExpression(node) {
        if (!approved && /^(?:axios|socket\.io-client)(?:\/|$)/.test(node.source.value)) report(node);
      },
      Identifier(node) {
        if (approved || !['fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource'].includes(node.name)) return;
        const parent = node.parent;
        if (node.name === 'fetch' && staticFetch) return;
        // Declarations, object keys and type annotations are not primitive use. References/aliases are.
        if (parent?.type === 'VariableDeclarator' && parent.id === node) return;
        if (parent?.type?.startsWith('TS')) return;
        if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
        if (parent?.type === 'Property' && parent.key === node && !parent.shorthand) return;
        report(node);
      },
      Property(node) {
        if (
          !approved &&
          node.parent?.type === 'ObjectPattern' &&
          ['fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource', 'sendBeacon'].includes(name(node.key))
        )
          report(node);
      },
      MemberExpression(node) {
        if (approved) return;
        const property = name(node.property);
        if (['fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource'].includes(property)) {
          if (!(property === 'fetch' && staticFetch)) report(node);
        }
        if (property === 'sendBeacon') report(node);
      },
    };
  },
};

export default { rules: { 'approved-primitives': networkBoundaries } };

// dependency-cruiser: genera SOLO il grafo docs/dependency-graph.svg.
// Nessuna regola bloccante qui — l'enforcement dei confini è compito di
// eslint-plugin-boundaries (CI rossa). Questa config serve alla
// visualizzazione (AD-1: `docs/dependency-graph.svg`).
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    exclude: {
      path: '\\.test\\.(ts|tsx)$',
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/(?:@[^/]+/[^/]+|[^/]+)',
      },
    },
  },
};

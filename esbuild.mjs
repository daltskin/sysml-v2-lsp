import * as esbuild from 'esbuild';

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const baseConfig = {
    bundle: true,
    sourcemap: !isProduction,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    logLevel: 'info',
};

// Server bundles: use syntax + whitespace minification only.
// Identifier minification is disabled because esbuild's DCE incorrectly
// removes the DFA snapshot (loadDFASnapshot mutates the parser's static
// DFA tables — a side effect esbuild cannot track).
/** @type {esbuild.BuildOptions} */
const serverMinify = isProduction
    ? { minifySyntax: true, minifyWhitespace: true, minifyIdentifiers: false }
    : {};

// Bundle the server
const serverBuild = esbuild.build({
    ...baseConfig,
    ...serverMinify,
    entryPoints: ['server/src/server.ts'],
    outfile: 'dist/server/server.js',
    external: ['vscode'],
});

// Bundle the parse worker (separate entry point for worker_threads)
const workerBuild = esbuild.build({
    ...baseConfig,
    ...serverMinify,
    entryPoints: ['server/src/parser/parseWorker.ts'],
    outfile: 'dist/server/parseWorker.js',
    external: ['vscode'],
});

// Bundle the MCP server
const mcpServerBuild = esbuild.build({
    ...baseConfig,
    ...serverMinify,
    entryPoints: ['server/src/mcpServer.ts'],
    outfile: 'dist/server/mcpServer.js',
    external: ['vscode'],
});

// Bundle the client (full minification is safe here — no DFA side effects)
const clientBuild = esbuild.build({
    ...baseConfig,
    minify: isProduction,
    entryPoints: ['client/src/extension.ts'],
    outfile: 'dist/client/extension.js',
    external: ['vscode'],
});

await Promise.all([serverBuild, workerBuild, mcpServerBuild, clientBuild]);
console.log(isProduction ? '✅ Production build complete' : '✅ Build complete');

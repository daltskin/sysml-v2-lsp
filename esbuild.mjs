import * as esbuild from 'esbuild';
import * as path from 'node:path';

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

// ---------------------------------------------------------------------------
// Browser (Web Worker) server bundle — runs the language server inside a
// vscode.dev web extension host, where there is no Node.js runtime or
// filesystem. Node built-ins are swapped for lightweight shims, the
// transport/library platform modules for their `.browser.ts` variants, and
// `vscode-languageserver/node` for the browser entry point.
// ---------------------------------------------------------------------------

/** Swap `./platform/<connection|libraryFiles>.js` for their `.browser.ts` variants. */
const browserPlatformPlugin = {
    name: 'browser-platform',
    setup(build) {
        build.onResolve({ filter: /platform\/(connection|libraryFiles)\.js$/ }, (args) => {
            // Preserve the relative directory prefix (e.g. `../platform/`),
            // only swapping the `.js` extension for `.browser.ts`.
            const browserPath = args.path.replace(/\.js$/, '.browser.ts');
            return { path: path.resolve(args.resolveDir, browserPath) };
        });
    },
};

const shim = (name) => path.resolve('server/src/platform/shims', name);

const browserServerBuild = esbuild.build({
    ...baseConfig,
    ...serverMinify,
    platform: 'browser',
    target: 'es2022',
    format: 'iife',
    entryPoints: ['server/src/server.ts'],
    outfile: 'dist/server/browserServerMain.js',
    external: ['vscode'],
    define: {
        // The server reads __dirname only to locate the on-disk library,
        // which is bundled in the browser build, so the value is unused.
        '__dirname': '"/"',
        // Flag the browser build so the server skips spawning a parse worker
        // (worker_threads is unavailable in the browser; parsing runs inline).
        '__SYSML_BROWSER_SERVER__': 'true',
    },
    alias: {
        'vscode-languageserver/node': 'vscode-languageserver/browser',
        'node:fs': shim('fs.ts'),
        'node:fs/promises': shim('fs-promises.ts'),
        'node:path': shim('path.ts'),
        'node:url': shim('url.ts'),
        'node:worker_threads': shim('worker_threads.ts'),
    },
    plugins: [browserPlatformPlugin],
});

await Promise.all([serverBuild, workerBuild, mcpServerBuild, clientBuild, browserServerBuild]);
console.log(isProduction ? '✅ Production build complete' : '✅ Build complete');

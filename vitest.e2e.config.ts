import { defineConfig } from 'vitest/config';

/**
 * Config for the slow, real-server e2e tier (`npm run test:e2e`), kept
 * separate from `vitest.config.ts` so the default fast unit suite never
 * pays for spawning the bundled server. Requires `dist/server/server.js` to
 * already be built -- `test:e2e` builds it first.
 */
export default defineConfig({
    test: {
        include: ['test/e2e/**/*.test.ts'],
        globals: true,
        environment: 'node',
        testTimeout: 30000,
        hookTimeout: 30000,
    },
});

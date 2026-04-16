import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/unit/**/*.test.ts'],
        globals: true,
        environment: 'node',
        testTimeout: 30000,
    },
});

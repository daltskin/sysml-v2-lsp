import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["clients/vscode/src/**/*.ts", "server/src/**/*.ts"],
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/no-explicit-any": "off",
            "no-case-declarations": "off",
        },
    },
    {
        ignores: [
            "dist/**",
            "out/**",
            "server/out/**",
            "clients/vscode/out/**",
            "server/src/generated/**",
            "server/src/parser/benchmark-warmup.ts",
            "**/*.js",
            "**/*.mjs",
            "**/*.cjs",
        ],
    }
);

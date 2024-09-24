import typescriptRules from "@gemunion/eslint-config/presets/tsx.mjs";
import jestRules from "@gemunion/eslint-config/tests/jest.mjs";

export default [
  {
    ignores: ["**/dist"],
  },

  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  ...typescriptRules,
  ...jestRules,
];

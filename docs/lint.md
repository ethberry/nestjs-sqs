# Lint

How ESLint runs in this repository: the config, the local commands, the commit hook and the CI step.

## Config

- One flat config, `eslint.config.mjs`. It spreads the `@ethberry/eslint-config` presets `presets/tsx.mjs` and
  `tests/jest.mjs` (a devDependency, held on the 5.x line).
- The preset's rules cover the test files (`*.unit.spec.ts`, `*.integration.spec.ts`) too, including
  `jest/no-focused-tests` as an error: a committed `.only` fails lint.
- Type-aware rules read `tsconfig.eslint.json`.
- Ignored: `**/dist`. A flat config does not read `.gitignore`: a generated folder that is not in `ignores` is linted.

## Commands

- `npm run lint`: `eslint .` over the repository, without `--fix`; it exits non-zero on any error. Warnings do not
  fail it. To fix what can be fixed: `npm run lint -- --fix`. ESLint is a dependency: it runs through the npm
  scripts, never through npx.
- Commit hook: husky runs lint-staged (`.lintstagedrc`), which runs `prettier --write` and `eslint --fix` on the staged
  `ts` / `tsx` files. The hook can be skipped, so it is not the guard.

## CI

- `ci-test.yml` (started by hand) runs `npm run lint` after install and build, before the tests; any lint error,
  a focused test included, fails the job.

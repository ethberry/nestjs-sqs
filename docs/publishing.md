# Build and publishing — nestjs-sqs

How the packages of this repository are built, what goes into a published package, how versions are chosen and how a release is made. The current state; history is in git.

## Packages

| Package | Folder | tsc target |
|---|---|---|
| `@ethberry/nestjs-sqs` | `.` | es2022 |

## Build

- `npm run build` compiles with `tsc` into `dist/` (`prebuild` empties it). ESM: `"type": "module"`, `module`/`moduleResolution` `nodenext`, exports from `dist/index.js` with `.d.ts` and source maps.
- Runtime: Node 26. `.nvmrc` holds the major, every `package.json` has `engines.node` `">=26"`, and the workflows use `node-version: "26.x"`; a local build or release runs under `nvm use` (the `.nvmrc` version).
- Targets in use: es2022 (1). A package that must run in older engines is the exception, not the rule; es5 is not used (async ESM code needs ES2015+).
- Tests, stories and test helpers are excluded from the build by the `exclude` list of each `tsconfig.json` (`*.spec.*`, `*.test.*`, `*.stories.*`, `test-utils.*`, `jest.setup.*`, `__mocks__`); tests type-check through `tsconfig.test.json` where a package has one. The `.npmignore` drops them again, so a leaked compiled spec would still not ship.
- Not obfuscated: single-package repositories publish plain code (ADR 0001 in common-packages).

## What a published package contains

- `dist/`, `README.md`, `package.json`, plus `CHANGELOG.md` / `LICENSE` where present. Nothing else.
- The guard is the root `.npmignore`: `src`, `tsconfig*.json`, jest / storybook configs, `**/*.spec.*`, `**/*.test.*`, `**/*.stories.*`, `**/test-utils.*`, `**/__mocks__`, `.env*`, `AGENTS.md`, `CLAUDE.md`, `docs/`, `eslint.config.mjs` and dot-files.
- Check before a release: `npm pack --dry-run` in a package folder lists exactly what will ship.

## Dependencies and peers

- Exact versions in `dependencies` / `devDependencies`; a range only in `peerDependencies`, one `^` range, never an OR (`^12.0.0`, not `^11.0.0 || ^12.0.0`), starting at the devDependency version it is built and tested with.
- A library that owns shared state (React, MUI, react-hook-form, Nest, wagmi, firebase, …) or that the consuming app also installs (viem) is a peer plus an exact devDependency, never a pinned dependency: a pinned copy is a second context / DI container, or pins the app's version.

## Versions

- `npm version patch|minor|major` (chosen by hand from the changes): bumps `package.json`, commits `[Manual release] [skip ci] <version>`, tags `v<version>`.

## Release

Registries: GitHub Packages `https://npm.pkg.github.com/` and npmjs `https://registry.npmjs.org/` (public). A consumer maps `@ethberry` to GitHub Packages and holds a token with `read:packages`.

**Manual (local), the usual way while GitHub Actions minutes are out**, from a clean checkout of `origin/main`:

1. `git fetch && git checkout -B main origin/main`; `npm ci`; `npm run build`.
2. `npm version patch|minor|major -m '[Manual release] [skip ci] %s'`.
3. GitHub Packages: `npm publish --@ethberry:registry=https://npm.pkg.github.com/` — the scope flag is required: the repository `.npmrc` maps `@ethberry` to npmjs, which overrides a plain `--registry`.
4. npmjs: `npm publish --access public` with a user config that maps `@ethberry` to npmjs and holds `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` (the token only in the environment, never in a file in the repository).
5. `git push && git push --tags`.

A 401 from npmjs (`npm whoami`) means the token expired or was revoked; a 404 on `PUT` means the request went to the wrong registry or the token cannot write the `@ethberry` scope.

**CI** (GitHub Actions):

- `ci-test.yml`: tests on pull requests.
- `manual.yml`: workflow_dispatch release with input `bump` (patch | minor | major): the manual steps above, both registries.

Secrets the workflows read: `GITHUBEMAIL`, `GITHUBTOKEN`, `GITHUBUSER`, `NPM_TOKEN`. `NPM_TOKEN` is an npmjs token that can publish `@ethberry/*`; `GITHUBTOKEN` / `GITHUBUSER` / `GITHUBEMAIL` push the release commit and publish to GitHub Packages.

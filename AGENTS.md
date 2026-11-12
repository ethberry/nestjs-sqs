# nestjs-sqs

`@ethberry/nestjs-sqs`: a NestJS microservice transport (server and client) over AWS SQS. A single package, not a monorepo.

## Place in the package levels

Level 1: no dependencies on other `@ethberry/*` runtime packages. Released before the repositories that use it.

## Commands

- Base branch: `main`.
- Install: `npm ci`.
- Build: `npm run build` (`tsc`). Lint: `npm run lint`.
- Tests: `npm run test:unit` (`*.unit.spec.ts`); `npm run test:integration` (`*.integration.spec.ts`) needs a local SQS: `npm run docker:sqs:up` starts ElasticMQ from `docker-compose.yml` with `elasticmq.conf`, and `docker:sqs:down` stops it. `npm run test` runs both.
- CI (`ci-test.yml`) on a PR: starts ElasticMQ in Docker, then install, build, lint, test.
- Release: `gh workflow run manual.yml --repo ethberry/nestjs-sqs --ref main -f bump=patch|minor|major`. The workflow runs `npm version` and publishes to GitHub Packages and to npmjs (public).

## Gotchas

- ESM only (`nodenext`, `.js` in relative imports). Jest runs with `NODE_OPTIONS=--experimental-vm-modules`.
- The version is set by the release workflow (`npm version`), not by conventional commits.
- The committed `.env` has the local endpoints for the integration tests (`ELASTICMQ_URL`, `LOCALSTACK_URL`).
- Dependency versions change only through Renovate.

## Docs

Usage is in `README.md`. Rules are in `.claude/rules/`, synced from the shared agent kit.

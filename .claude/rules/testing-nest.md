---
paths:
  - "**/*.unit-spec.ts"
  - "**/*.e2e-spec.ts"
  - "**/test/**/*.ts"
---

<!-- Shared rule (stacks: nestjs). Maintained outside this repository; local edits are overwritten. -->

# Tests in Nest repositories

Adds to the `testing` rule.

- Mock at the boundary of the system under test: another service's provider client, an external provider, the chain client, the transfer bus. Mock them through Nest DI (`app.get(Provider)` + `jest.spyOn`, or `overrideModule`), not by patching Node's HTTP stack for the whole process.
- In e2e tests, keep your own code real inside the boundary: services, repositories, DTO validation, the database (test Postgres / LocalStack from the repository's test compose).
- In a unit test of one service, its repositories are the boundary: mock their named methods (see the `typeorm` rule where it applies), never the database client underneath.
- New tests do not mock TypeORM itself (`Repository`, `DataSource`, query builder, `findOne`, `manager`). Existing tests that do are legacy; do not spread the pattern.

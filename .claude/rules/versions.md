<!-- Shared rule (stacks: base). Maintained outside this repository; local edits are overwritten. -->

# Versions and dependencies

- Dependency versions are changed by Renovate, not by hand. A major waits for approval in the Dependency Dashboard; approving it is a decision, not a routine merge. A manual version change needs the user's explicit decision and says so in the commit.
- Exact versions in `dependencies` and `devDependencies` (`save-exact`); ranges (`^`) only in `peerDependencies`.
- The runtime is Node 24 everywhere: `.nvmrc`, `engines.node: ">=24"`, Docker images and CI `node-version`. The runtime version is changed by hand, together in all those places.
- A version that is deliberately held back (a major that breaks tests, a library whose new major needs a tool we do not use) has a Renovate limit (`allowedVersions`) with a `description`, and an ADR in the repository that pins it.
- `@ethberry/*` packages come from GitHub Packages (`https://npm.pkg.github.com/`); the consumer maps the scope and holds a token with `read:packages` outside the repository. Tokens are never committed.
- A library that owns a React context, a DI token or a module-level singleton (forms, providers, wagmi, react-query, Nest modules) is a `peerDependency` of the packages that use it, never a pinned `dependency`: two installed copies mean two contexts. The consumer declares every peer in its own `dependencies` in the same exact version across apps.

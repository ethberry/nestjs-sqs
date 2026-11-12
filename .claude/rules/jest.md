---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/jest.config.*"
  - "**/jest.setup.ts"
  - "**/jest.environment.mjs"
---

<!-- Shared rule (stacks: jest). Maintained outside this repository; local edits are overwritten. -->

# Jest

Adds to the `testing` rule; Nest-specific mocking is in `testing-nest`.

## Config

- Each package has its own `jest.config.json`. Contract helper packages stay CommonJS (preset `ts-jest`, see the `packages` rule); ESM packages use `ts-jest/presets/default-esm` with `useESM: true`, the mapper `"^(\\.{1,2}/.*)\\.js$": "$1"` and run jest with `NODE_OPTIONS=--experimental-vm-modules`.
- The environment is `node` for logic, `jsdom` for components. Components that call the API or use streams use the shared fetch-enabled jsdom environment, not a mock of `fetch`.
- Tests sit next to the source in `src/`. A new test uses the file suffix its own package already uses (`*.test.ts(x)` or `*.spec.ts`); the package decides, not the repository.
- Every test file matches `testMatch`. A spec that the config does not pick up never runs: when adding a file or changing `testMatch`, check the test count. Integration tests that need real cloud credentials have their own suffix (`*.integration.spec.ts`) and script, and say in the file which env they need.

## Mocks

- `jest` comes from `import { jest } from "@jest/globals"`.
- In ESM, a module mock is `jest.unstable_mockModule("…", () => ({ … }))` before `const { X } = await import("./index.js")`. Plain `jest.mock` does not hoist in ESM.
- Mock at the boundary of the package (the API client, storage, notistack), never the code under test. Global mocks live in `jest.setup.ts`; state they hold is reset in `beforeEach`.

## React Testing Library

- Render with the providers the component needs (QueryClient with `retry: false`, IntlProvider, form) through one `wrapper`. A wrapper shared by several files lives in the package's `test-utils.ts(x)`.
- Query by role, label or `data-testid` (`screen.getByRole`, `getByLabelText`, `getByTestId`); not by class names or DOM structure.
- Interactions are `fireEvent` today; `userEvent` is added as a dev dependency by the package owner before it is used. Wait for async results with `findBy…` / `waitFor`, never timers.
- Assert behaviour (text, calls, values sent to the API). `asFragment()` snapshots stay where they exist; new tests do not add snapshots of whole components.

## Typing

- Test code follows the same typing rules as production code: no `any`, `as any` or `as unknown as`. A partial mock is typed with `jest.Mocked<Pick<T, "method">>` or a small interface.

```ts
// Bad
globalThis.api = { fetchJson } as any;

// Good
type FetchJson = (options: IFetchProps) => Promise<unknown>; // the real signature from the API package
const api = { fetchJson: jest.fn<FetchJson>() };
```

- `describe.skip` / `it.skip` are not committed to get green; see the `testing` rule.

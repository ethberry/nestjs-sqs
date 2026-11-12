<!-- Shared rule (stacks: base). Maintained outside this repository; local edits are overwritten. -->

# Testing

- Derive test cases from the acceptance criteria, not from the code you just wrote.
- A test proves a criterion only if it fails when the criterion is broken. For a bug fix, write the test first and see it fail on the old code; say so in the report.
- Test behaviour through the public API of the unit (a component's rendered output and form state, a package's exports, a contract's external functions and events), not private details.
- Every test cleans up the data it created, also when it fails (`afterEach` / `finally`), and does not depend on the order of other tests or on seed data it changes.
- No fixed waits (`setTimeout`, `waitForTimeout`) in tests: wait for a state.
- Focused tests are forbidden in every runner: `forbidOnly: true` for mocha and Playwright, `jest/no-focused-tests` as an error or `--ci` for jest. A forgotten `.only` in a shared behaviour silently drops every other test of its consumers.
- When a change touches test infrastructure, dependencies or shared behaviours, compare the number of tests per package before and after; a drop is a failure until explained.
- Do not weaken a check to get green: no skipped tests, raised timeouts, broader matchers or mocked-out code under test. A test that cannot run in CI is reported, not deleted.
- Published code is tested as it is published when the packaging matters (for example `require()` and `import` of the built `dist` in a separate process).

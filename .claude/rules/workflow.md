<!-- Shared rule (stacks: base). Maintained outside this repository; local edits are overwritten. -->

# Task workflow

1. **Start** — understand the task from the user or the reviewer. Write the acceptance criteria before writing code; if the task has none, propose them and get them confirmed. If the requirement is ambiguous, ask; do not guess.
2. **Branch** — before the first edit, switch to a branch for the task created from the repository's base branch (`AGENTS.md` → Commands → Base branch). Without a given name use `wip-<short-topic>`.
3. **Implement** — the smallest change that satisfies the criteria. Follow the rules. Stay inside this repository's area; what another repository must do is a message to its owner, not an edit there.
4. **Verify** — run the verification gates (`AGENTS.md` → Commands). Tests must check the acceptance criteria, not the implementation you just wrote (`testing` rule).
5. **Simplify** — KISS / DRY / YAGNI pass over the whole diff (`kiss-dry-yagni` rule). Re-run the affected checks.
6. **Review** — the change is reviewed by someone who did not write it. Fix or answer every finding. Merge only after the reviewer approves.
7. **Document** — knowledge notes, ADRs, `AGENTS.md` and package READMEs (`documentation` rule).
8. **Report** — what changed, the checks run with their outcome, what is left, and every question to the user that is still unanswered (from your "Needs the user" in the plan file, asked again). Follow-ups go to the plan file, not into code.

Problems noticed outside the task's scope are not fixed silently and not dropped: report them and add them to the plan file. A question to the user is not dropped either when it stays unanswered (missed, scrolled away, cannot be answered yet): it goes under "Needs the user" in the plan file with its date and is asked again (`documentation` rule, "The plan file").

## CI minutes

The GitHub Actions budget of the organisation is limited and shared by all repositories; package publishing alone takes most of it. Until the user says otherwise:

- Verify locally: run the repository's checks (build, tests, lint) on your machine and name them in the PR description with their outcome. A green local run is the gate for review.
- Do not start workflows by hand and do not re-run them without the user's yes. Releases are batched: publish only what a consumer needs now.
- Put `[skip ci]` into commit messages and the merge commit of changes that do not need CI (docs, agent rules, config without effect on the build).
- Test workflows run only by hand (`workflow_dispatch`), by the user's decision of 2026-11-12; there are no `pull_request` or `push` triggers for tests. Do not add triggers or new jobs; changing workflow triggers is the user's decision. A production deploy on push to its branch stays as it is.

## Definition of Done

- Every acceptance criterion is met and has a test or a recorded manual check that proves it.
- Lint, typecheck/build and the relevant tests were **run** and **passed** in this session, with the command named in the report.
- No new lint suppressions, `any`, double casts (`as unknown as`), `@ts-ignore`, skipped or focused tests, or raised timeouts introduced to get green.
- KISS / DRY / YAGNI pass done.
- Public interfaces (package exports, HTTP contracts, ABIs, events, DTOs, migrations) are backward compatible, or the break is a major version and is stated in the report and the changelog.
- Documentation updated.

## Reporting

Keep three statements apart: **test written**, **test run**, **test passed**. "Verified" means a check ran and passed in this session. When a check was not run, say so and why. When a check failed, show the failing output.

## Git

- Never write code on the base branch or on someone else's branch. Check `git branch --show-current` right before every commit and push; if it is not the task's branch, stop.
- Commit messages follow conventional commits (`fix:`, `feat:`, `feat!:` / `BREAKING CHANGE:` for a major, `chore:`, `docs:`, `test:`), one logical change per commit.
- A pull request targets the base branch. Its description says what changes and why, how it was verified (commands and results), and what is not verified.
- Do not force-push shared branches, do not rewrite pushed history, do not delete branches or tags without the user's yes.
- Uncommitted changes of another session in a shared checkout are not yours: do not stash, reset or commit them.

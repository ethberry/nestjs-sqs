<!-- Shared rule (stacks: base). Maintained outside this repository; local edits are overwritten. -->

# Documentation and decisions

Context ends; project knowledge must not. Anything whose loss would force someone to re-investigate, or would lead to a wrong decision, goes into the repository's `docs/`. `docs/` is committed with the code it describes.

## Where things live

| What | Where | Committed |
|---|---|---|
| What the project is, architecture, infrastructure, commands, gotchas, where the docs are | `AGENTS.md` (written by hand) | yes |
| Lasting knowledge about the system | `docs/<topic>.md`, index in `docs/README.md` | yes |
| Decisions a reader could take for a mistake | `docs/adr/NNNN-<title>.md` | yes |
| Package usage for consumers | the package's `README.md` | yes |
| Findings outside the task's scope, follow-ups, questions for the user | the workspace plan file (`PLAN.md` in the folder that holds the repositories), each session in its own section | no |

Do not create task-, plan- or status-files in `docs/`.

```
<repo>/docs/
  README.md            # index: one line per note and per ADR — keep it current
  <topic>.md           # knowledge notes, kebab-case
  adr/NNNN-<title>.md  # architecture decision records
```

Write in English, short sentences. Existing notes in another language stay as they are; continue a note in its own language.

## Knowledge notes (`docs/<topic>.md`)

Record:

- How a part of the system actually behaves when it is not obvious from one file: flows across modules or services, ordering, retries, idempotency, state transitions.
- Dependencies between components, packages and services, and contracts with external providers (what they really return, quirks, limits).
- Results of investigations: what was checked, what was found, what was ruled out.
- Implementation details a future change must respect.

Do not record: a list of files opened or changed, a diary of steps, anything the code or `git log` already says plainly, secrets or personal data.

Update an existing note instead of creating a parallel one. A note describes the current state; delete statements that became false. Add every new note to `docs/README.md`. Describe what is merged into the base branch, not work in progress.

- **No history in notes.** Describe how it works now. Do not compare with how it worked before or write which PR changed it. That belongs in `git log` and ADRs.
- **Configuration by name, never by value.** Name the config key and the env variable. Do not write the value it has now; values change in config and deployment without touching the note.
- **Keys and secrets.** Never write a secret. Committed test keys: describe only public, well-known ones (for example the Besu test accounts), by address and with a link to their source.

```md
<!-- Bad: history and current values -->
The form now submits raw values; until mui-form 16.1.1 it submitted the schema output.
The throttler allows 100 requests per minute.

<!-- Good: current behaviour, names only -->
A form submits the values its inputs hold; the schema only validates.
The throttler limits come from `THROTTLE_TTL` and `THROTTLE_LIMIT`.
```

## Architecture decision records (`docs/adr/`)

Write an ADR when a decision is not obvious from the code and a future reader could take it for a mistake: an unusual structure, a rejected "obvious" alternative, a pinned version, a constraint imposed by a tool, a provider or production. Number sequentially, never reuse a number.

- **Only decisions that were actually made.** How a part of the system behaves is a knowledge note, not an ADR.
- **The title states the decision, not a comparison.** "Chainlink stays on 1.4", not "Chainlink 1.4 instead of 1.5"; the rejected options go under Alternatives.

```md
# NNNN. <Decision in a short phrase>

Status: accepted | superseded by NNNN
Date: YYYY-MM-DD

## Context
What forced the decision. Constraints, facts, numbers.

## Decision
What we do.

## Alternatives
What else was considered and why it was rejected.

## Consequences
What becomes easier, harder, or must not be changed without revisiting this ADR.
```

Before changing code that an ADR covers, read the ADR. If the change contradicts it, write a new ADR that supersedes it (set the old one's status to `superseded by NNNN`); do not edit the decision of an accepted ADR.

## The plan file

Write the item into the plan file in the same turn you notice it, before you answer. Mentioning it in the reply, telling another session or adding a rule is not a record: only the plan file is. A mistake of your own (a missed review finding, a wrong claim, a broken build you let through) is recorded the same way.

While working on a task you notice things that are not part of it: a bug, a security hole, a test that never runs, a wrong doc, a rule the code breaks. They are out of scope, so you do not fix them now, and they are not ignored either. Write each one down in your section of the plan file, so it is picked up later.

- One item per finding: where (`repo` + `file:line`), what is wrong and what it causes, the proposed fix if you have one, and what it waits for (after the pause, another session, a decision).
- An item you cannot judge or fix without more information or a decision goes under **Needs the user** in your section, with the question in one sentence, and you tell the user about it in your report. Do not leave it for later silently.
- Every question you asked the user that is still unanswered also goes under **Needs the user** — whether it scrolled away, was not noticed or could not be answered yet — with the date it was asked and what waits on it. Ask it again in your next report; remove it once answered, and write the answer where it belongs (a note, an ADR, the item it unblocks).
- Security holes and data loss are marked as such and named in the report every time until they are taken into work.
- Remove an item when it is done or becomes a GitHub issue or PR (link it). The plan file is not a status log or a history of the session: what was merged is in git.
- Edit only your own section. A finding for another session's area goes into your section under "for <session>", and you tell that session.

## Package READMEs

A published package's `README.md` describes its current public API for a consumer: what it exports, required providers and peers, configuration by env name, and one minimal example. Breaking changes are described in the changelog (conventional commits), not as history in the README.

## Before finishing a task

Check whether the task changed something a note, an ADR, `AGENTS.md` or a README states. Update them in the same change, and add follow-ups to the plan file instead of fixing unrelated things.

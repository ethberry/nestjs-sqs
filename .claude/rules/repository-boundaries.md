<!-- Shared rule (stacks: base). Maintained outside this repository; local edits are overwritten. -->

# Repository boundaries

This repository is self-contained. Everything an agent needs to work here is in this repository.

- Other systems are external dependencies, described by contract only: service name, env var / base URL, API prefix, port, package name and version.
- Do not read, edit, run or link files of other repositories, and do not assume they are checked out next to this one. Exception: a script of this repository that needs another checkout says so itself; use it as documented, nothing more.
- No relative paths that leave the repository (`../<other repo>/...`) in code comments, docs, rules or task notes.
- A ticket that needs changes in several repositories is done repository by repository, each in its own session. Here, record what the other side must provide (the contract), not how it is implemented there.

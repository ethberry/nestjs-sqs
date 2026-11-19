# Now — nestjs-sqs

The resume point for this repository. A session that lost its context reads this first, then the files it links. Rewritten after every finished step, before the turn ends; about a screen long. Owned by the Packages session (the workspace rule Resume point).

**Checked:** 2026-11-19 (Packages, no-handler RPC reply fix).

**Repository.** Branch `test/sqs-integration-types` from `main`.

**Done since the last step.** The integration specs have no `any`. An RPC to a pattern without a handler now gets its error reply with the request's correlation `id` (it used the payload's `id`, so the call hung until its timeout); the new ElasticMQ case failed on the old code (15 s timeout) and passes now. Feature note [sqs-transport.md](sqs-transport.md). The local ElasticMQ / LocalStack containers are stopped (not removed) after the run.

**Waits on the user.** Nothing.

**Next.** Merge and a patch release (GitHub Packages and npmjs).

**Running.** Nothing.

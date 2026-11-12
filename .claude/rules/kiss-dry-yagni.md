<!-- Shared rule (stacks: base). Maintained outside this repository; local edits are overwritten. -->

# KISS, DRY, YAGNI

Applies to every file in every repository. Apply it while writing, then run it as a separate pass over the full diff before a task is finished and again before any commit. Do not finish or commit a change that fails the pass.

## KISS

Ship the smallest change that fixes the current case. Do not add a service, endpoint, helper, or abstraction for a single call site.

```ts
// Bad — a class whose only method forwards one call
class KycStatusService {
  map(snapshot: LatestVerificationSnapshot) {
    return mapClientKycVerificationStatus(snapshot);
  }
}

// Good — call the function
const status = mapClientKycVerificationStatus(snapshot);
```

- Prefer direct readable code over many private methods. A private helper needs a domain meaning, not just to hide two lines.
- Avoid helper chains where one helper only delegates to another.
- Prefer explicit `if` branches for business decisions.
- Do not introduce broad generic types when a narrow type is enough.

## DRY

Extract shared logic only when the same behavior already exists in two production places. Do not extract for a hypothetical second caller.

An abstraction (helper, service, strategy, shared utility, move to `libs`) is allowed only when at least one is true:

- The same logic is used in 2+ production places.
- The logic is complex enough that naming it materially improves readability.
- It protects a domain boundary, an external provider contract, a security rule, or a transaction boundary.
- It is required to test a non-trivial branch.

## YAGNI

Do not add placeholders, unused fields, future-provider branches, TODO-only branches, empty strategy implementations, or flags nobody reads. Unsupported providers fail explicitly with a clear business error. Add provider-specific rules only for providers the flow supports now; add a provider extension point only when a second real provider needs different behavior. Leave an existing enum value in place when removing it would break current clients, and do not return it from new code if the flow does not produce it.

## The simplification pass

During a task the change usually touches only the code it needs. The pass looks wider:

1. Read the full diff against the base branch (`git diff <base>...` plus uncommitted changes) plus the functions and modules the diff touches.
2. Look for: new code that duplicates something that already exists; helpers with one caller; parameters, fields, branches or types nothing reads; code made obsolete by the change; neighbouring code in the touched flow that can now be simpler.
3. Make the reductions that stay inside the task's flow. Record larger cleanups outside the flow as follow-ups instead of doing them.
4. Re-run the checks the reductions affect. A simplification that was not re-verified is not done.

Expect the pass to remove 5–10% of new code. If it removes nothing, say what you checked.

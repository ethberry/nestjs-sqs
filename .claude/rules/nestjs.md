---
paths:
  - "**/*.ts"
---

<!-- Shared rule (stacks: nestjs). Maintained outside this repository; local edits are overwritten. -->

# NestJS

## Where validation goes

- DTO validation for transport-level input checks.
- Service-level validation for business rules that need loaded entities, ownership checks, provider resolution or current state.
- Do not call external providers when an input can be rejected locally.
- Keep flow-specific validation close to the flow.

## Controller and service method order

When adding a method to a NestJS **controller** or **service**, **append** it — do not insert between existing methods.

### Public before private (services)

In **services**, keep this order:

1. Constructor and lifecycle hooks (`onModuleInit`, `onModuleDestroy`, …)
2. **Public** methods — new public methods go **after** the last existing public method
3. **Private** methods — new private methods go **after** the last existing private method

**New public methods must not be placed below private helpers.**

Controllers expose only public handlers; add new routes at the **bottom of the class**.

### Controller

```typescript
// ✅ GOOD — new handler last
async syncBalances(...) { ... }

async getTotalBalanceByAsset(...) { ... }
```

```typescript
// ❌ BAD — do not insert between existing handlers
async getSystemBalances(...) { ... }

async getTotalBalanceByAsset(...) { ... }  // wrong place

async getAccountFullBalance(...) { ... }
```

### Service

```typescript
// ✅ GOOD — new public after other public, before private
async syncBalances(...) { ... }

async getTotalBalanceByAsset(...) { ... }

private handleContractError(...) { ... }
```

```typescript
// ❌ BAD — public below private
private handleContractError(...) { ... }

async getTotalBalanceByAsset(...) { ... }
```

### When editing

- Add only the new method in the correct position; do not reorder unrelated existing methods.
- Test files (`*.spec.ts`, `*.e2e-spec.ts`) are not covered by this rule.

## No redundant re-exports

### Do not add

- An `index.ts` (or barrel) whose **only** job is to re-export from 3rd party package when consumers can import that place directly.

**Good:** 
  - `import { Request } from "express";`

**Avoid**:
  - `export { Request } from "express";`

### Allowed

- **Barrels that add value**: more than one substantive export, or local types/constants alongside re-exports.

### When removing a redundant barrel

- Update all imports to the **canonical path** (concrete file or original package).
- **Delete** the redundant `index.ts` (do not leave an empty or deprecated stub).

### Relation to feature barrels

Prefer `from './dto/update'` / `from './interfaces/import'` over `from './dto'` / `from './interfaces'` **when** the barrel would only forward a single file. If a folder grows multiple DTOs or interfaces, a barrel that lists **each** of them is fine.

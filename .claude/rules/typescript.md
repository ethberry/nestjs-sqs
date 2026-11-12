---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

<!-- Shared rule (stacks: typescript). Maintained outside this repository; local edits are overwritten. -->

# TypeScript

## TypeScript — Avoid Over-Defensive Style

Write straightforward code that matches types and invariants. Do **not** layer redundant “safety” everywhere. Validate at the boundary, then trust the contract inside the app.

### No `.trim()` in core layers (hard rule)

Do **not** call `.trim()` in **services**, **entities**, **repositories**, or **general helpers** (including shared `libs/helpers` and `libs/tests` utilities). Do not strip strings “just in case” between modules you control. Normalize **once** where input actually enters the process—DTO `class-transformer`, `ValidationPipe`, mapper on the HTTP/RPC boundary—not on every lookup, join, or model field.

Third-party blobs at the **true edge** may get one explicit normalization step **only** when the task calls for it; that is not permission to sprinkle `.trim()` elsewhere.

### Avoid

- **Habitual string cleanup before use**: do not `.trim()` (or similar) on every internal read of a string “just in case.” Normalize **once** at real boundaries (parse user input, external API response, env read) if needed; inside the app, trust the type and the contract.
- **Redundant checks** after TypeScript or control flow already narrows the type (e.g. `if (!x) return` then `x!` or another `if (!x)`).
- **Deep optional chaining / default soup** for values that are required by the domain at that layer (`a?.b?.c ?? ""` when `c` must exist).
- **Extra variables** whose only job is to re-check something already guaranteed.

### Prefer

- Clear types and single responsibility: validate or normalize at the edge; keep the core path simple.
- Let invalid states surface (fail fast, throw, or return a typed error) instead of silently “fixing” data at every call site.

```ts
// ❌ BAD — sanitize the same string five times because strings are scary
const clean = raw
  .trim()
  .split(/\s+/)
  .map(w => w.trim())
  .filter(Boolean)
  .join(" ")
  .trim();
```

```ts
// ✅ GOOD — normalize once where input enters (form, API, env); inside the app, use the string
const label = raw.split(/\s+/).filter(Boolean).join(" ");
```

#### `Set` / dedupe without a requirement

```ts
// ❌ BAD — dedupe twice because duplicates are theoretically possible in theory
return [...new Set([...new Set(items)])].map(transform);
```

```ts
// ✅ GOOD — keep order and duplicates unless the spec says “unique”
return items.map(transform);
```

#### Every map / record access wrapped in doubt

```ts
// ❌ BAD
for (const key of keys) {
  if (key in map && map[key] !== undefined && map[key] !== null && typeof map[key] === "object") {
    out.push(map[key]!);
  }
}
```

```ts
// ✅ GOOD — keys are valid by contract; bad data fails in tests
for (const key of keys) out.push(map[key]!);
```

#### Downgrading typed storage to `string` on read

```ts
// ❌ BAD — admit defeat to the wire format, then “fix” it upstairs
const row = await loadRow() as { tags: string[] };
return row.tags.map(t => t as Tag).filter(Boolean) as Tag[];
```

```ts
// ✅ GOOD — you own the schema; assert the type you stored
const row = await loadRow() as { tags: Tag[] };
return row.tags;
```

#### Optional chaining + default soup (required data dressed as optional)

```ts
// ❌ BAD — classic “I don’t trust my own types” lasagna (layers of ?? until meaning dies)
const displayName =
  row?.user?.profile?.name?.trim?.() ??
  row?.user?.email?.split?.("@")?.[0] ??
  "Guest";
```

```ts
// ✅ GOOD — if the screen needs a name here, model it: required field or explicit `string | null`
const displayName = row.user.profile.displayName;
```

#### Re-narrowing after control flow already narrowed

```ts
// ❌ BAD
if (!user) return;
if (user.id == null || user.id === "") return;
if (typeof user.id !== "string") return;
return fetch(`/api/users/${String(user.id)}`);
```

```ts
// ✅ GOOD
if (!user) return;
return fetch(`/api/users/${user.id}`);
```

#### Variables that only exist to re-check

```ts
// ❌ BAD
const id = entity.id;
if (id == null) throw new Error("no id");
if (typeof id !== "string") throw new Error("bad id");
return useId(id as string);
```

```ts
// ✅ GOOD
return useId(entity.id);
```

### When Defense Is Actually Appropriate

**At real boundaries only**: HTTP bodies, env vars, CLI args, third-party JSON, file contents, browser `localStorage`—**one** place per concern to trim (if trimming is genuinely required), parse, validate, coerce. Still: **do not habitually `.trim()`** deep in the domain; violations are over-defensive and hide broken contracts between code you own.

## TypeScript

### Imports

Avoid `import * as` when a **default import** or **destructured import** (`import { a, b } from 'pkg'`) expresses the dependency clearly.

- **Node built-ins:** destructure, e.g. `import { randomBytes } from 'node:crypto'`, not `import * as crypto from 'node:crypto'`.
- **npm packages:** default (`import pkg from 'pkg'`) or destructure named exports (`import { fn } from 'pkg'`) according to how the package exports.

Namespace imports are only justified when the module is consumed as a bag of many unrelated exports and picking defaults/named imports would be noisier without benefit.

**Example (named import from a package):**

```ts
import { createHash } from 'node:crypto';
```

## Types

The parameter is a class, DTO, or enum that already exists. The body reads its fields.

A method that needs a field from one class takes that class. A method that needs a field both classes already declare takes the union of those two classes. Do not add a type, `Pick`, or string union for one call site, and do not look the field up with `in`.

### One class

```ts
// Bad — a local alias for fields TransactionEntity already has
type Tx = Pick<TransactionEntity, 'accountId' | 'type'>;

function isForeignReward(tx: Tx, accountId: string) {
  return tx.accountId !== accountId && tx.type === NormalizedLedgerChainTxType.REWARD;
}
```

```ts
// Good — the entity is the parameter
function isForeignReward(tx: TransactionEntity, accountId: string) {
  return tx.accountId !== accountId && tx.type === NormalizedLedgerChainTxType.REWARD;
}
```

### The class that owns the field

```ts
// Bad — both queries, then a search for a field only one of them has
function applySourceTypeFilter(
  conditions: FindOptionsWhere<TransactionEntity>,
  input: GetTransactionsQueryDTO | GetOrdersQueryDTO,
) {
  if ('sourceType' in input && input.sourceType) {
    conditions.sourceType = In([input.sourceType]);
  }
}
```

```ts
// Good — sourceType lives on the transactions query
function applySourceTypeFilter(
  conditions: FindOptionsWhere<TransactionEntity>,
  input: GetTransactionsQueryDTO,
) {
  if (input.sourceType) {
    conditions.sourceType = In([input.sourceType]);
  }
}
```

### A field both classes already have

```ts
// Bad — a new interface that copies fromDate and toDate
interface DatedQuery {
  fromDate?: Date;
  toDate?: Date;
}

function applyDateFilters(conditions: FindOptionsWhere<TransactionEntity>, input: DatedQuery) {
  if (input.fromDate && input.toDate) {
    conditions.timestamp = Between(input.fromDate, input.toDate);
  }
}
```

```ts
// Good — both query classes already declare these fields
function applyDateFilters(
  conditions: FindOptionsWhere<TransactionEntity>,
  input: GetTransactionsQueryDTO | GetOrdersQueryDTO,
) {
  if (input.fromDate && input.toDate) {
    conditions.timestamp = Between(input.fromDate, input.toDate);
  }
}
```

### The enum

```ts
// Bad — the same two values, written as strings
const orderUiTypes = ['BUY', 'SWAP'] as const;
```

```ts
// Good — the enum that already names them
const orderUiTypes = [UiTransactionType.BUY, UiTransactionType.SWAP];
```

### A string union

```ts
// Bad — a union of the strings the enum already has
function isOrderUiType(uiType: 'BUY' | 'SWAP') {
  return uiType === 'BUY' || uiType === 'SWAP';
}
```

```ts
// Good — the same check on the enum
function isOrderUiType(uiType: UiTransactionType) {
  return uiType === UiTransactionType.BUY || uiType === UiTransactionType.SWAP;
}
```

### A type alias for a string union

```ts
// Bad — a type that only names a string union
type OrderUiType = 'BUY' | 'SWAP';

function isOrder(uiType: OrderUiType) {
  return uiType === 'BUY';
}
```

```ts
// Good — that union is already UiTransactionType
function isOrder(uiType: UiTransactionType) {
  return uiType === UiTransactionType.BUY;
}
```

### A fixed set of strings is an enum

When code works with a fixed set of string values and no enum names them yet, create the enum and use it everywhere. That includes:

- a union type;
- a `const` array of strings;
- string literals compared in `if` or `switch`.

The only strings left are the discriminants of a third-party library's own types (for example the AI SDK's `part.type === 'text-delta'`).

```ts
// Bad — the set lives only in a union and in literals scattered over the code
type TransactionSort = 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC';

if (sort === 'DATE_DESC') { ... }
```

```ts
// Good — one enum, used by the type, the checks and the schema
export enum TransactionSort {
  DATE_DESC = 'DATE_DESC',
  DATE_ASC = 'DATE_ASC',
  AMOUNT_DESC = 'AMOUNT_DESC',
}

if (sort === TransactionSort.DATE_DESC) { ... }
const schema = z.object({ sort: z.enum(TransactionSort).default(TransactionSort.DATE_DESC) });
```

### Values stored in the database: an enum on both sides

When the same strings live in the code and in a database column, they are an enum on both sides with the same values:

- in code, a TypeScript enum;
- in the database, a database enum type, for example Postgres `CREATE TYPE ... AS ENUM`.

This covers statuses, types, reasons, and key columns whose values the code knows. It applies to our own tables and to tables we only read, such as a replica of another service's database.

- **Values in upper case, equal to the member name** (`REFUSED = 'REFUSED'`), in code and in the database type. Other values only when an external contract fixes them (a provider's API, another service's column).
- **Never** a `varchar` column with string literals compared in code. A typo in a literal compiles and silently matches nothing.
- **Adding a value** is one change: the enum member, and the migration that adds the value to the database type (`ALTER TYPE ... ADD VALUE`).
- **A table we only read** gets the TypeScript enum of the values its column holds. The column type is the owner's business, but the code must never spell the values as raw strings.

```ts
// Bad — the database knows 'REFUSED', the code repeats it as a string
@Column({ type: 'varchar' })
status: string;

if (message.status === 'REFUSED') { ... }
```

```ts
// Bad — a union of three strings looks typed, but the set lives apart from the database: a value added in a
// migration and forgotten here (or the other way round) still compiles, and every check repeats a literal
@Column({ type: 'varchar' })
status: 'COMPLETE' | 'REFUSED' | 'ERROR';

if (message.status === 'REFUSED') { ... }
```

```ts
// Good — one TypeScript enum, one database enum type, the same three values
export enum MessageStatus {
  COMPLETE = 'COMPLETE',
  REFUSED = 'REFUSED',
  ERROR = 'ERROR',
}

@Column({ type: 'enum', enum: MessageStatus, enumName: 'message_status_enum' })
status: MessageStatus;

if (message.status === MessageStatus.REFUSED) { ... }

// migration
await queryRunner.query(`CREATE TYPE "message_status_enum" AS ENUM ('COMPLETE', 'REFUSED', 'ERROR')`);
```

### A real instance

```ts
// Bad — an empty object cast to the class
const query = {} as GetTransactionsQueryDTO;
query.uiType = UiTransactionType.SEND;
```

```ts
// Good — plainToInstance returns the class
const query = plainToInstance(GetTransactionsQueryDTO, {
  uiType: UiTransactionType.SEND,
});
```

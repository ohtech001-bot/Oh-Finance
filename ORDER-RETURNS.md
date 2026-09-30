# Order Returns: Local Implementation

## Deployment Gate

The migration `20260930000000_order_returns` is prepared locally only. It has
NOT been applied to Supabase. Do not deploy the updated API before applying
and validating this migration on an isolated PostgreSQL test database, then
obtaining approval for the production migration. Older database schemas do
not contain the new fields used by Prisma.

## Accounting

- Confirmed and partially paid orders with outstanding debt are eligible.
- Return a complete product line (its entire quantity), several lines, or all
  remaining lines. Partial quantities within a line are not implemented.
- The original order, products, and payment allocations stay unchanged.
- Order-level discounts are allocated proportionally across original product
  totals using the existing largest-remainder money allocator. All returns
  together can never exceed the original order total.
- Each product line can be returned once. Returns and their products are
  append-only records with tenant RLS and validated order/product ownership.
- Each positive return adds an ADJUSTMENT_CREDIT referencing the order in the
  customer ledger, inside the same transaction as the return and order update.
- Net order value = original total - returned amount.
- Remaining amount = max(net order value - historical paid amount, 0).
- Excess historical payment becomes available customer credit. It is not a
  new cash receipt. Later payments use net outstanding amounts.
- Financial writes share the customer advisory lock. Version checks and a
  unique request ID prevent stale or duplicate returns.
- Orders with returns cannot also be cancelled, preventing double credits.
- The existing PAID state means there is no amount left to collect, including
  a fully returned order. The UI also shows the return amount and net value.

## Verification Before Production

Run existing migrations only against an isolated test database, then run the
API integration tests with explicit test reset approval. Those tests truncate
test data: never point TEST_DATABASE_URL at Supabase production.

Required scenarios: partial and full returns; partially paid order credit;
payment after return; replay and concurrent requests; cross-tenant rejection;
immutable rows; rollback on failure; printed return totals; zero-price lines;
discount rounding; customer balance filtering and pagination at scale.

## Performance Changes

Customer balance filters paginate in PostgreSQL instead of loading up to
20,000 customers into application memory. Search input is debounced for 200ms;
obsolete list requests use AbortSignal. Order edit and print share the detail
query cache. No production performance measurements are claimed.

## Local Verification (2026-09-30)

Prisma client generation, TypeScript checks, lint, and the production build
passed. The test suite reports 224 passed and 147 database tests skipped.
The return calculation and service tests passed, including request
replay, invalid selections, version conflicts, and ledger failure propagation.
Independent reversal of a return credit is rejected by the ledger service
(unit tested) and protected by a trigger in the unapplied migration.
Playwright exercised the confirmation and submission flow at 390px and 1280px
with intercepted API responses (2 tests passed), including full/partial returns
and reopening order details. This validates the UI, not database accounting.

The local Docker engine could not start, so PostgreSQL integration tests and
the new SQL migration have not been executed. No production database writes,
deployment, commit, or push were performed. Integration tests remain a release
gate, including the deferred ledger/return-total constraints and numeric SQL
pagination. The existing large frontend bundle warning remains; latency has
not been benchmarked against production.

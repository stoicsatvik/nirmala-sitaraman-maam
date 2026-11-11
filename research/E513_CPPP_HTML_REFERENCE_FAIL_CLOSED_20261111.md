# E513 — CPPP HTML/navigation reference rejection (2026-11-11)

## Question

Can the current Central Public Procurement Portal (CPPP) homepage parser turn navigation, script or aggregate-table text into a tender reference and then emit a false public-money graph link?

## Pinned evidence

- Repository snapshot commit on `main`: `c36946bee06aabd299585eac56efbba219a5e7ed`
- Snapshot blob: `public/data/live/latest.json`, Git blob `3c91ad1f205efa41fdba74f8ef92c9cf767b5077`
- Snapshot generated at `2026-11-11T02:49:06.877Z`
- Snapshot summary: 10 sensors, 9 healthy, 77 records, 1 reconciled link.
- CPPP procurement sensor: 46 candidate records.

The single existing link has relation `procured → procured`, both endpoints from `cppp-procurement`, and a reference consisting of HTML login markup, JavaScript/captcha text and “Find My Nodal Officer”. It is page chrome, not a tender identifier. The confidence value of 1 therefore overstates the evidence; the link is not a financial flow or causal progression.

The main-branch parser used `cells.find(... tender|bid ...)` across every cell, falling back to arbitrary cell text. This allowed page chrome and aggregate table text to be selected as the reference.

## Snapshot replay

A deterministic replay of the proposed E513 filter against the pinned snapshot's actual `raw.cells`:

| Measure | Result |
|---|---:|
| CPPP candidate rows | 46 |
| Rows retained by title + second-cell reference filter | 20 |
| Rows rejected | 26 |
| Candidate graph links after the E512 context/same-state gate and E513 reference gate | 0 |
| Existing snapshot links | 1 |

The retained 20 are **syntactically plausible structured rows**, not 20 independently verified procurement events. They comprise the ten individually displayed tender rows and ten corrigendum/extension rows. The aggregate parent row containing the ten nested entries is rejected. The 26 rejected rows include navigation, header, script/login, empty, and aggregate-parent rows.

## Change in this draft

1. Add `isPlausibleTenderReference` as a fail-closed shape gate. It rejects HTML/script markup, navigation labels, date-only strings, implausibly long text and references without a stable alphanumeric/delimiter shape. It preserves the observed CPPP formats in the pinned snapshot, including slash, underscore, hyphen, alpha-prefix numeric and the `2026 DDK 09` year-code form.
2. Add `extractTenderReference(cells)`: require a plausible title in cell 0 and a plausible reference in cell 1. Reject multi-entry parent rows. Do not scan arbitrary cells for the words “tender” or “bid”.
3. Apply the same reference gate in `reconcileRecords`, in addition to E407's exact authority, jurisdiction and fiscal-year context, exactly-two-record requirement, and same-state rejection.
4. Add deterministic E513 tests for the observed HTML/login string, navigation text, current official reference shapes, the second-cell rule, the aggregate parent row, and malformed-reference link rejection.

The helper is a **syntactic filter**, not proof that every accepted string is an authoritative tender ID. A future source-specific audit should follow each accepted detail link and confirm the identifier on the official detail page. Source HTML can change; the cell-order assumption must be rechecked when the source schema changes.

## Validation

- Local Node 22.16 run: `node --experimental-strip-types --test tests/reconcile-e407.test.mjs`
- Result: **11/11 tests passed** (7 existing E407 controls + 4 E513 regressions).
- The snapshot replay above used the pinned main-branch JSON and the E513 predicate; it did not call the live source or mutate the snapshot.
- No GitHub Actions run was triggered (`[skip ci]` commits). No full live ingestion/dry-run was executed.
- No main-branch write, deployment, Supabase mutation, contact, paid API, or external commitment occurred.

## Claim states

- The pinned snapshot contains one malformed HTML-derived, same-state graph link: **SUPPORTED BY SNAPSHOT**.
- The E513 syntactic filter rejects the observed malformed/page-chrome cases while accepting the listed current reference shapes: **SUPPORTED BY LOCAL FIXTURE + SNAPSHOT REPLAY**.
- All 20 retained candidate rows are valid tender identifiers: **NOT YET PROVEN**.
- The live CPPP parser is robust to future source changes: **NOT YET PROVEN**.
- Any public-money flow or causal progression inferred from a shared tender reference: **NOT ESTABLISHED**.

## Next move

Keep this PR draft and stacked on E512. Review the parser assumptions and tests, then obtain an explicitly approved source-detail validation run. Do not merge or alter the hourly ingestion workflow without explicit approval.

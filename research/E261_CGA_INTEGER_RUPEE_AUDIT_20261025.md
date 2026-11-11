# E261 | CGA aggregate exact-rupee audit (25 October 2026)

**Scope:** Read-only audit of the repository's already-published public-source snapshot. No live ingestion, production database access, private data, payments, deployment or political inference.

## Falsifiable question

Can the CGA parser's direct `actualCrore * 10_000_000` conversion emit a non-integer INR amount even when the published aggregate has an exact whole-rupee representation?

**Yes.** Snapshot `public/data/live/latest.json` at blob SHA `e16f596584104d7f61921a64a5d7f68692eb9b71` (`generatedAt=2026-10-25T11:22:03.086Z`) contains six CGA August 2026 aggregate rows. One has an IEEE-754 fractional-rupee artifact:

- Source-labelled `Total Major Subsidies`, `actualCrore=187037.42`.
- Previous serialized `amountInr=1870374200000.0002`.
- Correct integer-rupee conversion: **1870374200000**.
- Observed anomaly: **1/6 aggregate rows**. This is a numerical serialization artifact, **not a discrepancy in the underlying government accounts**.

## Independent arithmetic controls on the same published snapshot

| Published CGA aggregate | Budget estimate (crore INR) | Actual through August (crore INR) |
|---|---:|---:|
| Revenue expenditure | 4,125,494 | 1,568,009 |
| Capital expenditure | 1,221,821 | 509,949 |
| Total expenditure | 5,347,315 | 2,077,958 |

Both source-reported identities hold exactly: `4,125,494 + 1,221,821 = 5,347,315` and `1,568,009 + 509,949 = 2,077,958`. Interest, loans and subsidies are **subsets** and must not be added again to the total. All figures are **provisional unaudited CGA aggregates**, not transaction-level evidence.

## Correction and test

- `scripts/lib/cga-units.ts`: round to an integer rupee only when the original decimal-crore amount is representable to whole-rupee precision; reject nonfinite, unsafe-integer and sub-rupee values.
- `scripts/sensors/cga.ts`: apply conversion before producing a source-backed record; abstain if the conversion is unsafe.
- `scripts/e261-cga-units.test.ts`: deterministic August source fixture, integer/negative/zero controls, unsafe and fractional boundary cases, and independent expenditure identities.
- No historical snapshot is rewritten. Its failure remains visible as an immutable negative control.

## Evidence and limitations

The audit compares already-ingested values against the **same snapshot's primary-source-derived raw cells**, not an independent re-download of the CGA source. It establishes a parser representation defect and an arithmetic sanity check, not comprehensive source accuracy. The current snapshot contains 31 records, 7/10 reachable sensors and zero reconciled links. In particular, public tender notices are not evidence of awards; that separate defect is addressed in the existing E190/E239 draft PR stack and is **not duplicated here**.

**Claim:** One fractional-rupee serialization defect SUPPORTED IN PUBLIC-SNAPSHOT AUDIT. Safe conversion SUPPORTED IN DETERMINISTIC TESTS once tests pass. Government expenditure correctness beyond these arithmetic controls NOT YET PROVEN.

**Next:** Compare future independent CGA report downloads against normalized source rows, test historical fiscal-period transitions, and preserve strict non-additive aggregate semantics.

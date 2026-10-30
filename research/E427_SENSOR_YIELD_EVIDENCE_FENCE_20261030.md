# E427 | Source reachability is not evidence coverage

**Date:** 2026-10-30. **Scope:** read-only audit of the existing published public-source snapshot; a draft-only UI classification correction. No political inference, database writes, new scraping, deployment, or live snapshot rewrite.

## Frozen source and falsifiable question

Source: `public/data/live/latest.json` on `main`, Git blob SHA-1 `b77937bd9dda1b473c998f9a3c05c4de9dcc91a0`, generated `2026-10-30T08:36:00.950Z`.

The UI calls `summary.healthySensors` a measure of healthy sensors and `summary.records` current observations. Do these measure usable, verified public-money evidence, or only collector reachability and raw row emission?

## Direct read-only results

| Measure | Source-derived count |
|---|---:|
| Sensors configured | 10 |
| `ok=true` (collector-reported reachability) | 9 |
| Sensors emitting at least one row | **6** |
| Sensors emitting zero rows | **4** |
| Reachable sensors with a nonempty error/limitation message | **2** |
| Unreachable sensors | 1 |
| Rows emitted by collectors | **77** |
| Rows independently adjudicated valid in this experiment | **0** |

The 2 reachable-but-limited sources are BMC budget and CPPP contract awards. GeM returned zero rows without an error, while PFMS was unreachable. A source can be reachable yet provide no usable rows; conversely, a row emitted by a parser is not necessarily a valid financial record.

**Separate known issue:** prior E301 [PR #11](https://github.com/stoicsatvik/nirmala-sitaraman-maam/pull/11) already found 26 structurally inadmissible CPPP rows among 46 in a prior snapshot, and its stacked E361 [PR #14](https://github.com/stoicsatvik/nirmala-sitaraman-maam/pull/14) distinguishes tenders from corrigenda. This E427 change does not duplicate, merge, or deploy those corrections and does not claim all 77 rows are genuine.

## Correction

Add a pure, fail-closed `summarizeSensorCoverage` and `sensorCollectionStatus` utility. The dashboard now separates **sources reachable**, **sources yielding rows**, and **rows emitted (not independently verified)**. A reachable source with an extraction warning is labelled *limited*; a reachable source with no rows is labelled *no rows*, not implicitly healthy. Preserve existing snapshot and backend schema for compatibility.

## Validation

Four exact helper-source Node 22 `--experimental-strip-types --test` tests passed locally on 2026-10-30, including the pinned ten-sensor counts, empty cohort, warnings and duplicate/invalid-count fail-closed cases. Standalone TypeScript `tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck src/sensor-health.ts` passed.

**Not run:** full Vite/TypeScript application build, browser integration, exact remote committed-source CI or live ingestion. The existing included Actions minutes were previously reported exhausted, so commits used `[skip ci]`. No cost-incurring CI was requested.

## Claims and next move

- Reachability versus row-yield mismatch: **SUPPORTED BY SOURCE SNAPSHOT**.
- Pure helper behavior: **SUPPORTED IN LOCAL TESTS**.
- Full dashboard integration: **NOT YET VERIFIED**.
- Public-money row correctness, tender/award classification, financial causality, and production remediation: **NOT YET PROVEN**.

Next: run the exact-head TypeScript/Vite build when free runners are available, then evaluate the E301/E361 admissibility filters and source-level precision/recall before using emitted-row counts as evidence coverage. Historical database rows and the public snapshot remain unchanged.

# E450 | Stale public-money snapshot freshness gate, 31 October 2026

## Question and frozen evidence

Does the live public-money dashboard distinguish an **old, successfully written snapshot** from a currently fresh hourly polling stream? On the existing E427 branch, `buildCoverage` marked the "Live polling" row `live` whenever `generatedAt` was nonempty, irrespective of age. The banner also described a source snapshot without explicitly stating whether it was stale.

The read-only `main` snapshot `public/data/live/latest.json` (Git blob `383f219fd7693feb045114fca1f6310aca29771c`, default-head `ef89efe098dd`) reports `generatedAt=2026-10-31T06:58:47.306Z`, 10 configured sensors and 77 emitted rows. At the **fixed audit instant** `2026-10-31T10:32:19.000Z` the snapshot was **213 completed minutes old**. The repository documents hourly polling, but this observation alone does not establish why a later snapshot was absent, whether a workflow was delayed, or whether the underlying government sources were unavailable.

## Reproduced defect and correction

- **Original behavior:** any nonempty timestamp, including a snapshot days old, was displayed as live.
- **Correction:** a pure, testable timestamp classifier uses an explicit **2-hour operational freshness threshold** (a declared policy, not a measured government-data SLA), a five-minute client clock-skew allowance, strict UTC timestamp admission and fail-closed unknown status for invalid/future dates.
- The dashboard marks the polling row `live` only for fresh snapshots; stale snapshots become `partial`, invalid timestamps `blocked`. Other dynamic `live` coverage rows are downgraded to `partial` when snapshot recency cannot be verified; static budget allocation is exempt. A visible warning states that emitted rows are historical observations, not current coverage.
- Existing sensor reachability and emitted-row counts remain unchanged. No published data, database state, or collector code was altered.

## Validation and limitations

Six exact-source local Node 22 type-stripping tests **PASSED** (119-minute fresh case, inclusive 120-minute boundary, fixed 213-minute stale snapshot, malformed/impossible timestamp rejection, future-clock rejection, nonfinite input/threshold rejection). Standalone TypeScript `tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck src/snapshot-freshness.ts` **PASSED**. Both new committed source/test files were read back and matched locally tested Git blob SHAs `d90f7131895195092fce4d6dd28b999bdafe4f44` and `2082b34d8d23e535b7c6c7e152812c1fb9f7e405`. The patched `src/live.ts` was read back as blob `3e2604316353847a3a5ac1a1266abf8cd12dcab3`.

**NOT RUN:** full Vite/TypeScript application build, DOM/browser integration, exact-head GitHub Actions, live source polling or independent financial-record adjudication. The runner is not assumed free; commits use `[skip ci]`. The fixed 213-minute observation is a point-in-time audit, not proof of persistent outage. Browser device-clock errors beyond the declared tolerance may yield unknown/stale status.

## Claims

- **REJECTED:** that timestamp presence alone proves currently live hourly polling.
- **SUPPORTED IN LOCAL TESTS:** timestamp freshness classification and stale/unknown controls.
- **NOT YET VERIFIED:** full dashboard integration and production behavior.
- **NOT YET PROVEN:** accuracy, completeness or correctness of emitted public-money records; source-level tender/award extraction; any financial causality or political wrongdoing.

## Next

Run the full application build and browser integration in confirmed no-charge capacity. Then reconcile ingestion timestamps against successful Actions completion times and audit E301/E361 procurement admissibility against source rows. Never equate polling success with verified expenditure evidence.

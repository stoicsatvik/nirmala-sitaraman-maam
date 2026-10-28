# E361 | Public Ledger India CPPP evidence-contamination falsification

Date: 2026-10-28. Scope: read-only audit of repository snapshot Git blob ac46c55959c94f9d9e781ef1654273c8f4ff46cb (public/data/live/latest.json, generated 2026-10-28T05:36:58.554Z). This is NOT an audit of government integrity or public expenditure; it tests our own parser and claims.

## Measured failure

The snapshot exposes 46 records from cppp-procurement, all marked procured. Their recorded raw.cells contain navigation (Screen Reader Access, Advanced Search), nested layout tables, JavaScript, HTML login markup, headings, actual tender rows and a separate corrigendum section. The old parser recursively traverses descendant td cells and guesses references from arbitrary text.

A conservative four-cell shape, numbered-title, plausible reference and two-date filter retains 11 of 46 snapshot rows, including a corrigendum entry. Eleven is an UPPER BOUND on plausible four-cell candidates, NOT a count of independently verified tenders. An explicit table-header gate is required to exclude corrigenda. Ten apparent tender listings remain for official-HTML verification.

The snapshot also contains one confidence=1 link with relation procured → procured connecting two enormous login/JavaScript navigation strings. Its reference contains HTML markup. This is a demonstrated false evidence-chain link created by our own code, NOT evidence of any government wrongdoing.

## Implemented fail-closed correction

1. Accept only direct four-cell rows under an exact Tender Title / Reference No / Closing Date / Bid Opening Date table header. Never recursively interpret layout cells as rows.
2. Reject malformed references, invalid dates, corrigendum tables, script/external URLs and ambiguous rows.
3. Label tender listings tendered, never procured. Database enum migration staged but NOT applied.
4. Link only unique plausible tender/award identifiers across different sensors, same authority, jurisdiction and fiscal year; never same-stage duplicates. This is an identity gate, not proof of payment or delivery.
5. Preserve historical snapshot and database history. No deletion, backfill, live ingestion, deployment or main merge.

## Validation and limits

Synthetic nested-table, navigation, HTML/script, date, reference, cross-authority, same-stage and fiscal-year controls run in CI. experiments/e361_snapshot_audit.ts reports the actual frozen snapshot without changing it.

SUPPORTED: historical false procurement records and false high-confidence link; deterministic software correction once exact-head CI passes.

NOT YET PROVEN: precision/recall on current official HTML, that all ten apparent tenders are correctly extracted, or that existing public database records have been repaired. Live snapshot remains contaminated until a separately authorized, migration-safe rollout.

Next: independent official HTML replay, manual tender/corrigendum labels, migration rehearsal on disposable DB, and explicit historical-link remediation. Never silently rewrite history.
# E301 | CPPP homepage table-structure falsification (2026-10-26)

## Decisive question
Does the published CPPP homepage collector count actual tender/corrigendum observations, or does its descendant-cell selector also promote navigation, nested layout tables and login JavaScript into procurement evidence?

## Source and frozen observation
- Read-only public repository snapshot: `public/data/live/latest.json` on `main`, generated `2026-10-26T06:09:32.746Z`, retrieved 26 October 2026.
- Sensor: `cppp-procurement`, original official endpoint `https://www.eprocure.gov.in/epublish/app?service=home`. No new live request was required.
- Snapshot contains **77 total records** across sensors, including **46 CPPP records** and **two reconciled links**.
- Of the 46 CPPP records, only **20** have exactly four cells, a numbered listing title, a plausible reference and two valid dated timestamps. **26/46 (56.52%)** fail the predeclared structural gate. This is a replay against an existing source-derived snapshot, not independent confirmation of 20 tenders.
- The 20 admitted records comprise **10 latest tender rows and 10 corrigendum rows**. A parent `<tr>` holding nested tables and a page-login script were among the rejected records.
- One of the snapshot's two purported `procured → procured` links used a **226-character HTML/login/JavaScript-derived reference**. The other linked two corrigenda with the same tender reference at the same notice stage. Neither establishes an award, payment or money flow. The stacked E278 reconciliation logic already rejects both same-stage and invalid-reference links; E301 closes the earlier source-record admission hole.

## Falsification and correction
The original collector used `$(row).find("td")` over every `table tr`, which recursively included descendant cells from nested layout tables, and accepted any two-cell row. That admitted navigation labels, page chrome, and JavaScript as tender records. The E301 branch:
1. Uses **direct-child** `td` cells, not nested descendants.
2. Requires exactly four cells, numbered title, constrained reference, and two valid day/month/year 12-hour timestamps.
3. Rejects HTML/code and malformed dates, while retaining legitimate free-text tender titles and references.
4. Preserves `tender_published` stage and labels the record as a tender/**corrigendum homepage listing**, never an award/payment.
5. Emits an explicit zero-admissible-rows message rather than silently converting page reachability into transaction evidence.

The gate intentionally prefers false negatives when the official layout changes. It does **not** establish independent authenticity, award status, vendor identity or transaction flows.

## Validation and negative evidence
- Offline Node 22 `--experimental-strip-types` fixture tests: genuine-shaped tender, corrigendum and long-reference rows accepted; nested/layout/login/script, invalid dates, bad references and code rejected. These fixtures are deterministic and do not pretend to be newly retrieved government records.
- Frozen-snapshot structural replay: **20 admitted, 26 rejected** from the 46 previously emitted CPPP records. This is a **replay estimate**, not a newly executed production ingestion.
- `tests/cppp-home-rows.test.ts` is included in the repository's evidence-integrity CI alongside inherited reconciliation and type/build checks.
- **No public snapshot rewrite, production ingestion, database deletion or live link cleanup was performed.** Historical `live_records` and `record_links` may retain previously admitted false positives until an approved, audited cleanup. Do not claim that this branch retroactively fixes existing public data.

## Claim states
- Prior CPPP collector's record-count validity: **REJECTED FOR THE OBSERVED SNAPSHOT**.
- Structural admission and 20/46 replay count: **SUPPORTED FOR THE FROZEN SNAPSHOT AND DETERMINISTIC FIXTURES**.
- Actual current official page coverage, precision/recall, independently verified tender identities and financial causality: **NOT YET PROVEN**.

## Next discriminating experiment
On an isolated read-only branch, retrieve a fresh official CPPP homepage response, compare strict extraction with the visible latest-tender and corrigendum tables, measure false negatives, and verify stable row identity across two polling times. Audit any previously persisted false-positive records before seeking explicit approval for a reversible cleanup. Never silently rewrite historical evidence.

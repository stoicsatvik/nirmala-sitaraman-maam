# E512 | Six-snapshot persistence of public-ledger integrity failures (2026-11-03)

## Falsifiable question

Was E488's source-pinned snapshot failure an isolated transient, or did the same classes of evidence-integrity failures persist through subsequent published sensor snapshots?

**Result: persistence across six pinned published snapshots.** This is a read-only source-observation result, not a claim of misconduct, actual public-money movement, or a statistically representative longitudinal error rate.

## Source and method

- Repository: `stoicsatvik/nirmala-sitaraman-maam`, file `public/data/live/latest.json`.
- Six distinct Git commits and their exact Git blob SHAs are frozen in `research/receipts/e512_six_snapshot_integrity.json`.
- Snapshot `generatedAt` spans **2026-11-01 09:12:38 UTC to 2026-11-02 18:18:16 UTC** (approximately 33.1 hours).
- Read the complete JSON for each commit through the connected GitHub API, and independently replayed E488's predicates in V8: composite `(sensorId, externalKey)` identity uniqueness; HTML/JavaScript/CAPTCHA contamination in `tenderReference`; endpoint resolution; state equality; authority/jurisdiction/fiscal-year agreement; normalized tender-reference agreement; and whether a mere `exact_tender_reference` basis is being represented as a directional financial event.
- The independently executed V8 replay is not a native execution of the Python E488 CLI. GitHub-hosted snapshots were **not** independently checked against live CPPP pages, and no database, public deployment, source record, or live infrastructure was modified.

## Observed cohort

| Git commit prefix | Snapshot generated (UTC) | Records | Duplicate identity groups | Markup-bearing record references | Directional links | Unsupported links |
|---|---|---:|---:|---:|---:|---:|
| `924aab96` | Nov 1 09:12 | 77 | 2 | 3 | 3 | 3 |
| `d83a6429` | Nov 1 16:00 | 77 | 2 | 3 | 3 | 3 |
| `5ae79da8` | Nov 1 20:29 | 77 | 2 | 3 | 3 | 3 |
| `60d2d4fd` | Nov 2 00:40 | 77 | 2 | 3 | 3 | 3 |
| `654c77b9` | Nov 2 07:39 | 77 | 2 | 3 | 1 | 1 |
| `80f1faa7` | Nov 2 18:18 | 77 | 2 | 3 | 2 | 2 |

**15/15 published link observations fail the conservative financial-progression gate.** All 15 are labelled `procured → procured` with an `exact_tender_reference` basis. Their shared reference may support a *co-reference* assertion after source verification, but cannot establish a directed change of financial state. One of the link observations in each snapshot also contains login-page HTML/JavaScript in the reference field.

The same two duplicate record identity groups persist in all six snapshots: `cppp-procurement:advanced-search` and `cppp-procurement:faq-feedback:faq-feedback`, both within the CPPP sensor. Three records per snapshot contain markup-bearing tender references. Summary totals agree with observed counts in all six snapshots; 9/10 sensors report `ok: true` in each snapshot. Correct summary counts therefore do **not** imply semantic correctness.

Link counts fluctuate **3 → 3 → 3 → 3 → 1 → 2**, and at least one non-markup link changes between early and late snapshots. This variability is observed; its upstream cause has not been established. Six snapshots of the same publishing pipeline are dependent observations, not six independent data sources.

## Claim boundaries and next experiment

- **SUPPORTED:** The same identity/markup failure classes and unsupported direction-labelled links persisted across six pinned published snapshots, despite changing link counts.
- **REJECTED for these snapshots:** The interpretation that the published `procured → procured` edges prove money progressed from one financial state to another.
- **NOT YET PROVEN:** Official CPPP source correctness, genuine procurement/payment relations, population-wide error frequency, provenance authenticity beyond GitHub blobs, and effectiveness of production remediation.
- **Next decisive test:** Replay actual section-labelled tender/corrigendum/award publications from independent official CPPP sources with source-provenance receipts, and compare E407's strict same-state rejection against current live ingestion *offline*. Verify whether any truly distinct-state financial transitions survive without relying on string similarity.
- **Safety:** Do not infer political wrongdoing or edit the public site, data pipeline, database, or main branch autonomously.

This report preserves a negative empirical result rather than adding a new speculative scoring system.

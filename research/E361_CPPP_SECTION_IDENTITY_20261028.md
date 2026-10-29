# E361 | CPPP tender-versus-corrigendum section-identity gate

2026-10-28. This experiment is stacked on E339 (draft PR #12), which itself builds on E301 and E278. It does NOT reimplement or replace their established direct-cell, short-reference, source-scoped identity and historical-stage gates.

## What was falsified

The prior E301/E339 parser deliberately admits both latest tender and latest corrigendum four-cell rows. E339's official visible 27-Oct sample contains 10 tenders and 10 corrigenda, all 20 structurally admissible. Treating the 20 admitted rows as 20 new tenders would double-count the ten corrigenda. A four-cell row alone does not encode its source section.

The separate 28-Oct frozen main snapshot (public/data/live/latest.json Git blob ac46c55959c94f9d9e781ef1654273c8f4ff46cb) still contains 46 old procured-labelled CPPP records and one demonstrably false HTML/login confidence-1 link. E301/E278 already diagnosed and addressed much of this; the live snapshot was not repaired. The newly isolated question is whether header-aware parsing can distinguish the two publication kinds without losing E339's short HK1 references.

## Incremental correction

1. Traverse direct table rows only and require a local four-column header identifying Tender Title or Corrigendum Title.
2. Preserve both row types, attach publicationKind=tender|corrigendum, retain the original tender_published lifecycle stage, and reject nonofficial/script detail URLs.
3. Count only tender-kind CPPP rows in the dashboard's tender coverage, not corrigenda.
4. Preserve two distinct HK1 corrigendum rows without asserting that they are distinct procurement identities.

## Evidence boundary

SUPPORTED IN SYNTHETIC SOFTWARE TESTS after CI: nested layout isolation, section identity, short-reference retention and official-URL gate. E339's source-visible 10/10 split is an external convenience sample, not a raw HTML-hashed source.

NOT YET PROVEN: live official-HTML header compatibility, precision/recall across multiple dates, unique tender identities, award/payment links or repaired public history. A failed live header match must return zero rows rather than inventing evidence.

Next: independently archive two official raw HTML responses with timestamps, compare section-aware extraction against manual source-rendered labels, then rehearse migrations/remediation only in disposable infrastructure. No main merge, live ingestion, spending, outreach or database mutation.
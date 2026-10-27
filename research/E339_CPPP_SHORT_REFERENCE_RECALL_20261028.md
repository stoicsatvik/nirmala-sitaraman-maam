# E339 | CPPP homepage short-reference recall falsification (28 October 2026)

## Question
Does E301's five-character minimum for a CPPP homepage reference exclude a structurally valid listing that is visibly present on the official publication surface?

**Yes, in the inspected source-rendered sample.** The official [CPPP ePublishing homepage](https://www.eprocure.gov.in/epublish/app?service=home), displaying **27-Oct-2026** when read on **28-Oct-2026**, showed ten Latest Tenders and ten Latest Corrigendums. Two corrigendum rows had reference **HK1**, three characters long, with numbered titles and valid closing/opening timestamps.

## Frozen evidence and reproduction
- The twenty four-column rows were manually transcribed from the source-rendered page into `tests/cppp-home-live-sample.test.ts`; this is **not** a cryptographically pinned raw HTML snapshot, a second independent poll, or an identity-verified government tender dataset.
- Original E301 parser (reference length >= 5): **18/20 accepted; 2/20 rejected**. Both rejects were the visible `HK1` corrigendum rows.
- Changed only the lower bound to **3**; all other structural, numbered-title, digit, timestamp, HTML/code, and reference-character checks remain unchanged. New parser: **20/20 accepted** on this convenience sample.
- Two-character, nonnumeric, code-like, malformed-date, and page-furniture controls still fail closed. The two `HK1` headings remain distinct rows, **not** independently verified distinct procurement events.
- Locally executed Node 22 `--experimental-strip-types --test`: three E339 tests passed. The old threshold was also run against the same fixture and failed exactly the two `HK1` rows.
- CI on the draft PR must independently verify the exact GitHub head. No live sensor ingestion, database write, cleanup, deployment, or source modification was performed.

## Claim states
- **SUPPORTED FOR THIS SOURCE-RENDERED SAMPLE:** E301's five-character gate misses two visible short-reference rows.
- **SUPPORTED IN TESTED SOFTWARE:** relaxing the bound to three admits all twenty transcribed rows while preserving the tested negative controls.
- **NOT YET PROVEN:** source-row authenticity, independent record identity, recall across other days, official-site structural precision/recall, tender awards, payments, or any public-money flow.
- The visible `HK1` duplication and title spelling variation make deduplication **ambiguous**. Do not merge on reference alone.
- The historical false-positive records found in E301 remain unchanged. This correction does not authorize rewriting any live history.

## Next uncertainty-reducing experiment
Obtain two independently timestamped, read-only raw HTML responses from the official portal where permitted; parse direct-child cells and compare against a separately labeled visible table. Quantify admission precision, recall, and stable identity by publication stage. Retain any false negatives, including references shorter than three characters, rather than silently loosening the gate without evidence.

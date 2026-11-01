# E471 | Maharashtra programme-budget publication admission | 2026-11-01

## Question and source
Can the current official-source index collector distinguish a numbered Maharashtra FY 2026-27 programme-budget PDF from navigation/menu links before publishing a record as budget evidence?

Primary index: https://finance.maharashtra.gov.in/en/document-category/program-budget-2026-27-part-1/
Pinned observed snapshot: main \`public/data/live/latest.json\`, generated 2026-11-01T02:11:53.546Z, blob e512401937de8678bf335cb2eb5e214fc031862c.
Index contains six numbered publication rows (1–6), with PDF links, plus a navigation link named "Documents". This is a source-listing audit, NOT a content audit of the PDFs or of budget amounts.

## Falsification
Main's collector accepted 7 Maharashtra records: 6 numbered official PDF rows and one false navigation row with title beginning "Publications Handbook RTI ...". That false record had source URL https://finance.maharashtra.gov.in/en/documents/ (an index, not a PDF). Root cause: ancestor text matched the loose "Publication" predicate and a URL containing "document" was admitted as a document.

Main also fabricates a "budgeted" index observation if zero PDFs pass. An index's reachability alone does not establish a programme-budget publication.

## Correction, isolated from main
- Require an explicit numbered "Publication" / "प्रकाशन क्रमांक" row, not ancestor navigation text.
- Require HTTPS, the official Finance Department or S3WAAS document host, and a PDF pathname.
- Preserve the six known document rows; reject the navigation false positive.
- When no documents are admissible, return zero records with a diagnostic rather than inventing a budget record.
- Clearly state that PDF contents and monetary line items are NOT independently verified by this collector.

## Deterministic controls
Node 22 \`node --experimental-strip-types --test tests/maharashtra-publication.test.mjs\`: 6/6 tests passed locally, including six known numbered rows, navigation contamination, generic PDFs, foreign/HTTP/script URLs, relative PDF links, extension spoofing, and oversized ancestor text. Standalone TypeScript \`tsc --noEmit --target es2022 --module esnext --moduleResolution bundler\` on the pure helper passed.

Read-only independent source audit: 7/7 previously emitted Maharashtra records classified; 6/7 admissible numbered PDF rows, 1/7 rejected navigation. This is a fixed observed cohort, not an estimate of the live parser's general precision/recall. No new source polling, PDF content extraction, real-money amounts, database migration or deployment occurred.

## Claim boundaries
- Navigation-link false admission in the pinned main snapshot: REJECTED by source inspection.
- Corrected document admission: SUPPORTED BY PINNED SOURCE-ROW CONTROLS AND LOCAL TESTS.
- End-to-end live HTML/DOM extraction, full Vite build, exact-head CI, source PDF contents, programme amount accuracy, public deployment: NOT YET VERIFIED.
- Existing \`state: "budgeted"\` remains a schema-level limitation for link-only observations; it does not prove funds were budgeted or spent.
- The CPPP false rows and same-state spurious links visible in the same pinned snapshot are addressed by the pre-existing E301/E361 and E407/E408 draft streams. Do not duplicate or claim those corrections as E471.

## Next
Run full source-exact TypeScript/Vite build and actual index HTML fixture through the sensor on no-cost capacity. Independently parse at least one numbered PDF with fiscal-year/unit/provenance checks before representing amounts. Integrate prior CPPP and reconciliation drafts only after isolated test and approval; never merge main automatically.

# E386 | CPPP portal-origin evidence-link gate and 29-Oct snapshot audit

Date: 2026-10-29. Scope: read-only public-money provenance and isolated draft PR #14. This is a follow-on to E361, not an independent new procurement data feed.

## Reproduced defect

Before this correction, `officialCpppDetailUrl("https://other-department.gov.in/not-a-cppp-tender", "https://www.eprocure.gov.in/epublish/app?service=home")` returned the unrelated government-domain URL. A generic `*.gov.in` hostname is not sufficient evidence that a link is a CPPP tender detail. The same function already rejected `javascript:` and non-government hosts. The E386 regression rejects unrelated `gov.in` origins, lookalike domains and `gov.in` apex links while retaining HTTPS links on `eprocure.gov.in` and its subdomains. Unverifiable links fall back to the original CPPP source URL, **not** to a claimed record-specific detail.

This is a software provenance boundary, not evidence that the official CPPP site contained a malicious link.

## Independent frozen-main snapshot check

Source: [public/data/live/latest.json at main commit e0c9dc6d](https://github.com/stoicsatvik/nirmala-sitaraman-maam/blob/e0c9dc6d42afca5ddd743248510c6078d10659ea/public/data/live/latest.json). Git blob SHA: `65c04cc850d64f7a9fe35253bc7d4cdf4754411f`. Snapshot generated at `2026-10-29T02:25:27.485Z`. No current external CPPP HTML was downloaded or independently verified for this audit.

The old **main** ingestion output reports **46** CPPP procurement records, all 46 labelled `state=procured` and all 46 lacking `raw.publicationKind`. We independently checked each record's stored `raw.cells` using the frozen descriptive predicate: exactly four cells; third and fourth cells each match `DD-Mon-YYYY hh:mm AM/PM`; title begins with an enumerated item number. Exactly **20/46** satisfy that minimal structural predicate (indices 10–19 and 23–32); **26/46** do not. The 20 candidate rows lie in two consecutive blocks of ten separated by a `Corrigendum Title` header in the stored records, consistent with ten latest-tender and ten latest-corrigendum listings. This is **not** an independent verification of 20 unique official tender notices: stored flattened cells do not preserve the original HTML's direct-cell or table ancestry.

The 26 structural non-candidates include navigation, HTML/script and page-footer records. Counting 46 as 46 completed procurements or 46 new tenders is therefore unsupported. E190/E301/E339/E361 already address the larger publication-stage, direct-cell and section-identity failures on stacked **unmerged** branches. E386 adds the narrower independent portal-origin link gate and an exact 29-Oct snapshot audit. No production snapshot, history, database or main branch was changed.

## Claim and next test

- **SUPPORTED IN TESTED SOFTWARE:** prior unrelated-`gov.in` URL acceptance; corrected portal-host restriction with regression fixtures.
- **SUPPORTED IN STORED SNAPSHOT:** 46 untyped, `procured`-labelled CPPP records, 20 minimally plausible four-cell rows, 26 structural non-candidates.
- **NOT YET PROVEN:** live official HTML compatibility, source-rendered manual labels, unique tender identities, any awards/payments, or deployed data remediation.
- **Next decisive experiment:** capture two independently timestamped, checksum-identified official CPPP HTML responses; manually label tender/corrigendum/navigation rows; measure precision and recall against the frozen section-aware extractor. Do not promote publication to award/payment and do not touch production history without explicit approval.

No outreach, external spending, source alteration, live ingestion or main merge occurred.

# E488 | Pinned live-snapshot integrity falsification (2026-11-02)

## Question
Does the current public-money sensor snapshot support the three `confidence: 1` directional financial edges it publishes, and are record identities and tender references unambiguous?

## Source and read-only method
- GitHub repository: `stoicsatvik/nirmala-sitaraman-maam`, main commit `60d2d4fdfa29771ee3b0f4bede1b5b1f08cd253b`.
- Source: `public/data/live/latest.json`, Git blob SHA-1 `ad6b21c19fd1d30724881f46123a8f17c9b8fc25`.
- Snapshot `generatedAt`: `2026-11-02T00:40:57.793Z`.
- Source contents read through the connected GitHub API. No source website was re-fetched and no database or public site was modified.
- A separate V8 read-only audit inspected all 77 source records and all three links. The new Python gate's nine local synthetic controls passed. The full 168 KB snapshot was not executed through the Python CLI in this run; the V8 source-cohort audit and Python synthetic tests are distinct validation layers.

## Measured findings
| Invariant | Pinned source result |
|---|---:|
| Published records | 77 |
| Unique `(sensorId, externalKey)` groups | 75 |
| Duplicate identity groups | 2 |
| Published directional links | 3 |
| Same-state `procured → procured` links | 3/3 |
| Links whose relation claims unsupported direction from mere shared tender reference | 3/3 |
| Link references containing HTML/markup | 1/3 |
| Record tender references containing markup/script/captcha patterns | 3 |
| Eligible distinct-state pairs under the existing E407 conservative gate | 0 |

The duplicate identities are `cppp-procurement:advanced-search` and `cppp-procurement:faq-feedback:faq-feedback` within the CPPP sensor. These are page-navigation records, not evidence of procurement payments. The third invalid link contains HTML login-page content as a purported tender reference. The other two join distinct publications that share tender text but are both labelled `procured`. These are **publication/identity problems**, not evidence of fiscal wrongdoing.

## Interpretation
The hypothesis that all three published edges demonstrate distinct public-money progression is **REJECTED for this pinned snapshot**. A shared tender string cannot independently prove movement of money. The existing E407 draft already rejects same-state and ambiguous links; E488 adds an independently pinned *real-snapshot* counterexample and a reusable read-only publication integrity gate, rather than duplicating E407's reconciliation patch.

## Validation and limits
- `python -m unittest -v research/test_e488_snapshot_integrity.py`: **9/9 passed locally**, using exact source/test bytes later verified against GitHub blob hashes.
- `python -m py_compile`: PASS.
- Independent read-only V8 inspection of the pinned GitHub snapshot: 77 records, 2 duplicate groups, 3 markup-bearing record references, 3/3 unsupported directional links.
- The snapshot is a **single** hourly observation, not a longitudinal error rate. Other snapshots may differ. No independent CPPP HTML fetch, official source reconciliation, full application CI or live database audit was performed.
- The Python audit is intentionally fail-closed for public presentation; it is not a claim of verified government transaction identity or wrongdoing.

## Next falsifiable move
1. Run the exact Python gate against the pinned full JSON in a no-cost environment, then integrate it as a read-only pre-publication check on a separate draft branch.
2. Replay official CPPP section-labelled rows through E361 and compare source-level tender/corrigendum precision and recall.
3. Ensure a published snapshot cannot silently promote navigation text, duplicate record identities, or same-state co-reference to financial flow.
4. Audit historical persisted edges read-only before any remediation. No live infrastructure changes without explicit approval.

**Claim states:** Pinned snapshot integrity violations SUPPORTED BY READ-ONLY SOURCE AUDIT; E407 conservative software guard SUPPORTED BY PRIOR CI; production remediation NOT YET PROVEN; actual financial-flow tracing NOT YET PROVEN.

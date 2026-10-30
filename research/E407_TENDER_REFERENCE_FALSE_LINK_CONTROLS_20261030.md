# E407 | Tender-reference false-link falsification

**30 October 2026.** This is a synthetic, read-only public-money provenance
test. It makes no accusation about any government, contractor or person.

## Question

Does exact normalized tender-reference text, by itself, establish that two
records belong to the same financial chain and that one state caused the next?

**No.** The original reconciler grouped all records solely by reference,
sorted them by budget/procurement/payment state, and emitted directional
state-transition links with confidence 1. It did not check authority,
jurisdiction, fiscal year or multi-record ambiguity.

## Test-first negative controls

The [expected-red run](https://github.com/stoicsatvik/nirmala-sitaraman-maam/actions/runs/40980384671)
reproduced unsupported links for deliberately constructed cross-authority,
cross-year, duplicate-state, missing-year and ambiguous records. Seven
predeclared tests include one legitimate same-context positive control.

The correction:
1. requires nonempty matching authority, jurisdiction and fiscal-year context;
2. refuses ambiguous groups of three or more, duplicate external keys, and
   same-state pairs;
3. emits `shared_tender_reference` rather than a fabricated causal state arrow;
4. retains confidence 1 only for exact text match, **not** for transaction
   identity, legal liability, payment or causation.

This conservative policy may miss legitimate cross-year procurement chains.
False negatives are preferable to falsely asserting a public-money trail.
No existing database links were deleted, and no live ingestion was triggered.

## Claim states

- Original same-reference ⇒ verified progression: **REJECTED IN SYNTHETIC TESTS**.
- Fail-closed exact-reference co-occurrence: **SUPPORTED IN TESTED SOFTWARE**,
  subject to final CI.
- Actual public-source chain identity and completeness: **NOT YET PROVEN**.
- Existing live database links: **NOT AUDITED OR MODIFIED**.

## Next

Audit existing persisted links for cross-authority/fiscal-year collisions in
a read-only snapshot. Replace the current persistence lookup's bare
`externalKey` with an unambiguous `(sensorId, externalKey)` composite
identifier before relaxing the two-record limit. Require primary-source
evidence for directional sanction/payment/delivery transitions.

## Reproduce

```bash
node --experimental-strip-types --test tests/reconcile-e407.test.mjs
```

No live deployment, ingestion, outreach, spending or main merge.

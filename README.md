# Public Ledger India

A public-money observability layer for India.

The product goal is simple: show citizens what can legally be known about how public money moves from revenue collection to budget allocation, sanction, release, procurement, payment, delivery and audit.

## Core rule

Never pretend that a citizen's individual tax rupee can literally be traced after it enters the Consolidated Fund. The product distinguishes:

- **Observed** — directly reported by a primary source.
- **Calculated** — derived mechanically from observed figures.
- **Estimated** — modelled or proportionally attributed.
- **Audited** — supported by an audit finding.
- **Unknown** — not publicly disclosed or not yet reconciled.

Likewise, `budgeted`, `revised`, `sanctioned`, `released`, `procured`, `paid`, `delivered`, and `audited` are separate states. They must never be silently collapsed into one number.

## MVP

The first build covers Union Government public finance and provides:

1. **My ₹100** — proportional attribution of a citizen's estimated tax contribution across broad expenditure categories.
2. **Money graph** — a traversable graph from Government revenue → ministry → scheme → sanction → procurement → payment → project/outcome.
3. **Evidence ledger** — every amount carries source URL, financial year, evidence type, retrieval date, confidence and status.
4. **Unknowns** — missing, delayed, under-settlement and unreconciled information is shown explicitly rather than guessed.

## Stack

- Vite + TypeScript frontend
- Local typed seed data for the first prototype
- PostgreSQL/Supabase schema for the provenance graph
- Source adapters for India Budget, CGA, CAG, CPPP/eProcure, Parliament/MEA and state portals

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Verify

```bash
npm run typecheck
npm run validate:data
npm run build
```

## Data policy

The public graph should ingest only lawfully available public information. Private citizen tax documents, if supported later, belong in a separate encrypted private zone and must never be published into the public graph.

Primary-source links are included with each record. Seed numbers are illustrative unless explicitly marked as official; the UI labels provenance rather than making political judgments.

## Repository layout

```text
src/
  data/seed.ts          Typed prototype dataset
  main.ts               App rendering and interactions
  styles.css            UI
  types.ts              Domain model
scripts/
  validate-seed.mjs     Data integrity checks
supabase/migrations/
  001_public_money_graph.sql
```

## Next ingestion targets

- Union Budget 2026–27: Budget at a Glance + Expenditure Profile
- Controller General of Accounts monthly/annual actuals
- Central Public Procurement Portal contract/tender data
- CAG audit findings
- Parliament questions and ministry disclosures
- Maharashtra budget and Mahakosh after Union reconciliation is stable

This repository is not affiliated with the Government of India or any political party.

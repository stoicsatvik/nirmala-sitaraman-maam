# Public Ledger India

A provenance-first public-money observability layer for India.

The goal is to show citizens what can legally be known about how public money moves from revenue collection to budget allocation, sanction, release, procurement, payment, delivery, outcome and audit.

## Non-negotiable data rule

Never pretend that a citizen's individual tax rupee can literally be traced after it enters pooled public funds. The product distinguishes:

- **Observed** — directly reported by a primary source.
- **Calculated** — mechanically derived from observed figures.
- **Estimated** — modelled or proportionally attributed.
- **Audited** — supported by an audit finding.
- **Unknown** — not publicly disclosed or not yet reconciled.

Likewise, `budgeted`, `revised`, `sanctioned`, `released`, `procured`, `paid`, `delivered`, and `audited` are separate states. They must never be silently collapsed into one number.

## What is implemented

### Citizen interface

- **My ₹100** proportional attribution using the official FY 2026–27 broad expenditure split.
- **Public-money graph** from revenue → fund → appropriation → ministry → scheme → procurement → vendor → project → outcome/audit.
- **Evidence ledger** with primary-source links and evidence labels.
- **Live sensor dashboard** reading the latest source-poll snapshot without browser caching.

### Public-source sensor network

The ingestion runner currently monitors:

1. Controller General of Accounts monthly-accounts publication surface.
2. PFMS availability for sanctions/releases.
3. Central Public Procurement Portal latest tenders.
4. Government e-Marketplace public bid surface.
5. CPPP contract-award publication surface.
6. CAG audit-report index.
7. Union Output Outcome Monitoring Framework 2026–27.
8. Maharashtra Finance Department FY 2026–27 programme budget.
9. BMC budget publication surface.
10. BMC tender publication surface.

GitHub Actions polls these sources hourly and writes `public/data/live/latest.json`. The snapshot explicitly records source health, retrieval time, record count and errors. A successful source poll does **not** mean that a source exposes transaction-level data.

### Backend

Supabase/Postgres migrations provide:

- `sources`
- `ledger_nodes`
- `money_records`
- `ledger_edges`
- `audit_findings`
- `sensors`
- `ingestion_runs`
- `live_records`
- `record_history`

Every live record can carry amount, state, authority, fiscal year, vendor, tender reference, location text, coordinates, geographic precision, source URL and an evidence hash. History is append-preserved by evidence hash instead of silently overwriting changed public records.

## Tracking coverage

| Layer | Current implementation |
| --- | --- |
| Union Budget allocation | Implemented |
| Citizen tax attribution | Implemented as proportional modelling |
| Budget → ministry → scheme graph | Implemented data model |
| Sanctions/releases | PFMS source monitoring; structured public extraction still partial |
| CGA actual expenditure | Publication monitoring; granular monthly parser still partial |
| Tenders | CPPP + GeM + BMC public-source polling |
| Contract awards | CPPP award surface monitored; search results remain source-gated where captcha/search input is required |
| Vendor/payee | Fields/schema ready; populated only when primary evidence exposes it |
| Government payments | Schema ready; no claim of bank/treasury telemetry |
| Project/location | BMC tender location/ward extraction where stated |
| CAG findings | Report discovery live; finding-level extraction remains partial |
| Outcomes | Official 2026–27 Output Outcome Monitoring Framework sensor added; achieved-outcome extraction remains separate |
| Maharashtra | FY 2026–27 Finance Department sensor active |
| Mumbai/BMC/ward | Budget + tender sensors active; ward text retained where present |
| Live polling | Hourly GitHub Action plus push/manual triggers |
| Geographic pinpointing | Coordinates only when evidenced; no invented map pins |

## Accuracy semantics

"Live" means **freshly polled public-source information**. It does not mean access to RBI, PFMS, bank, treasury or private internal transaction streams.

A record may therefore be:

```text
published by government → observed by sensor → hashed → normalized → stored → shown
```

with freshness measured as:

```text
our_observed_at - government_publication_time
```

The system deliberately refuses to manufacture precision. A source saying "M/W Ward" stays ward-level. It does not become a street coordinate unless an auditable location source supports that conversion.

## Stack

- Vite + TypeScript frontend
- Node/TypeScript ingestion workers
- Cheerio for conservative public HTML extraction
- Supabase/PostgreSQL provenance store
- GitHub Actions hourly polling
- Static JSON snapshot fallback when Supabase secrets are not configured

## Run locally

```bash
npm install
npm run dev
```

## Run ingestion

```bash
npm run ingest:dry
```

This polls the sources and writes `public/data/live/latest.json` without writing to Supabase.

For database persistence, configure:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

then run:

```bash
npm run ingest
```

## Verify

```bash
npm run validate:seed
npm run build
```

## Database setup

Apply, in order:

```text
supabase/migrations/001_public_money_graph.sql
supabase/migrations/002_live_ingestion.sql
```

## Legal / privacy boundary

The public graph ingests lawfully available public information. Private citizen tax records, PAN-linked information, bank records and non-public government credentials do not belong in this graph.

Private citizen documents, if supported later, require a separate encrypted private zone and must never be merged into the public graph by default.

This repository is not affiliated with the Government of India or any political party.

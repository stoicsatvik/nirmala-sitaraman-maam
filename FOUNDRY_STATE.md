# Foundry State

## Classification

Tier A — primary priority.

## Mission

Build a neutral, provenance-first public-money observability layer from lawfully available primary public records. Preserve distinctions between budgeted, revised, sanctioned, released, procured, paid, delivered, outcome, and audited states.

## Evidence frontier

### SUPPORTED

- Repository software models public-money records with explicit provenance/evidence semantics.
- Public-source sensor infrastructure exists for CGA, PFMS availability, CPPP, GeM, CAG, Union outcome documents, Maharashtra Finance, and BMC publication surfaces.
- The CGA sensor includes a conservative parser for provisional monthly aggregate expenditure and labels those records as provisional/unaudited aggregate account figures rather than individual treasury transactions.
- Hourly source polling writes freshness/source-health snapshots to `public/data/live/latest.json`.

### NOT YET PROVEN

- Complete or transaction-level visibility into Union, Maharashtra, BMC, PFMS, treasury, bank, vendor/payee, project, or ward-level public-money flows.
- That every monitored publication surface is structurally parsed rather than merely health-checked/discovered.
- End-to-end reconciliation from appropriation through payment, delivery, outcome, and audit.
- Geographic precision beyond what a primary source explicitly supports.
- Citizen-level tracing of an individual's tax rupees after entry into pooled public funds.
- Any inference of corruption, wrongdoing, intent, or political responsibility from missing, delayed, anomalous, or unreconciled records alone.

## Neutrality and safety invariants

- Primary-source facts and mechanical calculations may be displayed; political persuasion is out of scope.
- Missing data means unknown/unreconciled, not wrongdoing.
- Never collapse budgeted, sanctioned, released, procured, paid, delivered, outcome, and audited states.
- Never manufacture coordinates, vendors, payments, outcomes, audit findings, or transaction granularity.
- Private PAN-linked tax records, bank records, private government credentials, and other non-public personal records do not enter the public graph.
- A successful source poll proves reachability/freshness only, not completeness or transaction-level coverage.

## Current blocker

The graph is broader than its structured evidence coverage. Several sources are monitored or discovered but not yet normalized into versioned, independently reproducible records. There is no demonstrated end-to-end reconciliation chain across allocation → sanction/release → procurement/award → payment → delivery/outcome → audit.

## Highest-EV next action

Create deterministic parser fixtures for one primary-source chain, beginning with the existing CGA monthly actual-expenditure parser. Freeze source HTML fixtures and assert exact period, budget estimate, provisional actual, units, evidence URL, evidence state, and failure-closed behavior under malformed/changed markup. Only after parser reproducibility is demonstrated should another money-flow state be promoted from monitored/discovered to structured evidence.

## Claim policy

Use only: PROVEN / SUPPORTED / NOT YET PROVEN / REJECTED / BLOCKED / PARKED / SUPERSEDED. Software tests can support parser and provenance behavior; they cannot prove government-data completeness, policy outcomes, corruption, or political claims.

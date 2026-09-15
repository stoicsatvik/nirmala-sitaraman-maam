create extension if not exists pgcrypto;

create type public.evidence_status as enum (
  'observed',
  'calculated',
  'estimated',
  'audited',
  'unknown'
);

create type public.money_state as enum (
  'budgeted',
  'revised',
  'sanctioned',
  'released',
  'procured',
  'paid',
  'delivered',
  'audited'
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  external_key text unique not null,
  title text not null,
  publisher text not null,
  source_url text not null,
  fiscal_year text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  evidence_status public.evidence_status not null default 'observed',
  sha256 text,
  metadata jsonb not null default '{}'::jsonb
);

create table public.ledger_nodes (
  id uuid primary key default gen_random_uuid(),
  external_key text unique not null,
  label text not null,
  node_type text not null,
  jurisdiction text,
  fiscal_year text,
  geography jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.money_records (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.ledger_nodes(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete restrict,
  state public.money_state not null,
  evidence_status public.evidence_status not null,
  amount_inr numeric(24,2),
  amount_basis text,
  period_start date,
  period_end date,
  as_of_date date,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint amount_non_negative check (amount_inr is null or amount_inr >= 0)
);

create table public.ledger_edges (
  id uuid primary key default gen_random_uuid(),
  from_node_id uuid not null references public.ledger_nodes(id) on delete cascade,
  to_node_id uuid not null references public.ledger_nodes(id) on delete cascade,
  source_id uuid references public.sources(id) on delete restrict,
  relation text not null,
  state public.money_state not null,
  evidence_status public.evidence_status not null,
  amount_inr numeric(24,2),
  valid_from date,
  valid_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint edge_not_self check (from_node_id <> to_node_id),
  constraint edge_amount_non_negative check (amount_inr is null or amount_inr >= 0)
);

create table public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete restrict,
  node_id uuid references public.ledger_nodes(id) on delete cascade,
  finding_key text unique,
  title text not null,
  finding_text text not null,
  amount_inr numeric(24,2),
  finding_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ledger_nodes_type_idx on public.ledger_nodes(node_type);
create index ledger_nodes_fy_idx on public.ledger_nodes(fiscal_year);
create index money_records_node_idx on public.money_records(node_id);
create index money_records_state_idx on public.money_records(state);
create index money_records_source_idx on public.money_records(source_id);
create index ledger_edges_from_idx on public.ledger_edges(from_node_id);
create index ledger_edges_to_idx on public.ledger_edges(to_node_id);
create index ledger_edges_state_idx on public.ledger_edges(state);

alter table public.sources enable row level security;
alter table public.ledger_nodes enable row level security;
alter table public.money_records enable row level security;
alter table public.ledger_edges enable row level security;
alter table public.audit_findings enable row level security;

create policy "public read sources" on public.sources for select using (true);
create policy "public read ledger nodes" on public.ledger_nodes for select using (true);
create policy "public read money records" on public.money_records for select using (true);
create policy "public read ledger edges" on public.ledger_edges for select using (true);
create policy "public read audit findings" on public.audit_findings for select using (true);

comment on table public.money_records is
'Each row represents one evidenced monetary state. Budgeted, released, paid and audited values remain separate rows rather than overwriting each other.';

comment on table public.ledger_edges is
'Provenance-aware links between public-money entities. Unknown evidence remains explicitly unknown; it must not be inferred as zero.';

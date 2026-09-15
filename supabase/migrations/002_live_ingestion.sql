create type public.ingestion_status as enum ('running', 'success', 'partial', 'failed');

create table public.sensors (
  id text primary key,
  label text not null,
  authority text not null,
  scope text not null check (scope in ('union', 'state', 'municipal')),
  kind text not null check (kind in ('budget', 'accounts', 'procurement', 'audit', 'outcome')),
  source_url text not null,
  expected_freshness text,
  enabled boolean not null default true,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_record_count integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.ingestion_status not null default 'running',
  sensor_count integer not null default 0,
  successful_sensor_count integer not null default 0,
  record_count integer not null default 0,
  commit_sha text,
  metadata jsonb not null default '{}'::jsonb
);

create table public.live_records (
  id uuid primary key default gen_random_uuid(),
  external_key text not null,
  sensor_id text not null references public.sensors(id) on delete cascade,
  title text not null,
  authority text not null,
  jurisdiction text not null,
  fiscal_year text,
  state public.money_state not null,
  amount_inr numeric(24,2),
  published_at timestamptz,
  observed_at timestamptz not null,
  source_url text not null,
  source_document text,
  location_text text,
  latitude double precision,
  longitude double precision,
  geographic_precision text check (
    geographic_precision is null or geographic_precision in (
      'source_coordinate', 'address', 'locality', 'district', 'state', 'unknown'
    )
  ),
  vendor text,
  tender_reference text,
  scheme text,
  ministry text,
  note text,
  evidence_hash text not null,
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(sensor_id, external_key)
);

create table public.record_history (
  id uuid primary key default gen_random_uuid(),
  live_record_id uuid not null references public.live_records(id) on delete cascade,
  evidence_hash text not null,
  observed_at timestamptz not null,
  snapshot jsonb not null,
  unique(live_record_id, evidence_hash)
);

create index live_records_sensor_idx on public.live_records(sensor_id);
create index live_records_state_idx on public.live_records(state);
create index live_records_jurisdiction_idx on public.live_records(jurisdiction);
create index live_records_fiscal_year_idx on public.live_records(fiscal_year);
create index live_records_vendor_idx on public.live_records(vendor);
create index live_records_tender_idx on public.live_records(tender_reference);
create index live_records_location_idx on public.live_records(location_text);
create index live_records_observed_idx on public.live_records(observed_at desc);
create index record_history_record_idx on public.record_history(live_record_id, observed_at desc);

alter table public.sensors enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.live_records enable row level security;
alter table public.record_history enable row level security;

create policy "public read sensors" on public.sensors for select using (true);
create policy "public read ingestion runs" on public.ingestion_runs for select using (true);
create policy "public read live records" on public.live_records for select using (true);
create policy "public read record history" on public.record_history for select using (true);

comment on table public.live_records is
'Latest public-source observation for each externally identified record. Values are not treated as literal real-time treasury transactions unless the originating public source exposes that granularity.';

comment on column public.live_records.geographic_precision is
'Coordinates are only stored when supported by source evidence or a separately auditable geocoding step. Never imply street-level precision from a district/state label.';

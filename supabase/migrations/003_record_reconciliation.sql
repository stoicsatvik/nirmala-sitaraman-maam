create table public.record_links (
  id uuid primary key default gen_random_uuid(),
  from_live_record_id uuid not null references public.live_records(id) on delete cascade,
  to_live_record_id uuid not null references public.live_records(id) on delete cascade,
  relation text not null,
  match_basis text not null check (match_basis in ('exact_tender_reference', 'exact_external_reference')),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  reference text not null,
  created_at timestamptz not null default now(),
  unique(from_live_record_id, to_live_record_id, match_basis, reference),
  constraint no_self_record_link check (from_live_record_id <> to_live_record_id)
);

create index record_links_from_idx on public.record_links(from_live_record_id);
create index record_links_to_idx on public.record_links(to_live_record_id);
create index record_links_reference_idx on public.record_links(reference);

alter table public.record_links enable row level security;
create policy "public read record links" on public.record_links for select using (true);

comment on table public.record_links is
'Deterministic links between public-source observations. Production links use exact source identifiers first; fuzzy or model-inferred matches must not be silently promoted to verified links.';

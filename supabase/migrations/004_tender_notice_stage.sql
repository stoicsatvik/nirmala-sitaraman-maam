-- A tender publication does not establish a contract award or expenditure.
-- Preserve all prior record_history snapshots and evidence hashes. The next
-- authorized ingestion will upsert current notice rows using this new state.
-- Do not rewrite old observations or silently promote them to awards.
alter type public.money_state add value if not exists 'tender_published' before 'procured';

comment on type public.money_state is
'Distinct evidence states: tender_published means an invitation to bid, not a contract award, vendor payment, delivery, or audited outcome.';

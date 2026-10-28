-- E361: separate tender publication from a completed procurement/award.
-- Documentation and migration only; do not apply to live infrastructure without approval.
ALTER TYPE public.money_state ADD VALUE IF NOT EXISTS 'tendered';

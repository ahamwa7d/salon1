-- ===========================================================================
-- Salon POS — licence table (seller's master Supabase project ONLY)
--
-- Run this once in the project that owns the licences, never in a client
-- project. The n8n workflow reads this table with the service_role key:
--
--   GET  /rest/v1/salon_licenses?license_key=eq.<key>&status=eq.active
--   PATCH /rest/v1/salon_licenses?id=eq.<id>   { "status": "used", ... }
--
-- The site itself never talks to this table, and RLS has no policies, so the
-- anon / publishable key can neither read nor write it.
-- ===========================================================================

create table if not exists public.salon_licenses (
  id uuid primary key default gen_random_uuid(),
  license_key text not null unique,
  status text not null default 'active'
    check (status in ('active', 'used', 'revoked', 'expired')),
  plan text not null default 'standard',
  customer_name text,
  customer_email text,
  customer_phone text,
  notes text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz,
  deployed_site_url text,
  deployed_supabase_url text
);

create index if not exists idx_salon_licenses_status
  on public.salon_licenses (status);

alter table public.salon_licenses enable row level security;

-- Intentionally no policies: only the service_role key (n8n / SQL Editor) can
-- read or write. Revoke the table grants as a second layer of defence.
revoke all on public.salon_licenses from anon, authenticated;
grant all on public.salon_licenses to service_role;

-- Test licence used by install.html while setting the product up.
insert into public.salon_licenses (license_key, status, plan, customer_name, notes)
values ('TEST-1234', 'active', 'test', 'End-to-end test', 'Seeded by supabase/salon-licenses.sql')
on conflict (license_key) do nothing;

-- Optional helper for issuing a key from the SQL Editor:
--   select public.issue_salon_license('standard', 'Salon name', 'owner@example.com', '+973...');
create or replace function public.issue_salon_license(
  p_plan text default 'standard',
  p_customer_name text default null,
  p_customer_email text default null,
  p_customer_phone text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  loop
    v_key := 'AWJ-SLN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.salon_licenses where license_key = v_key);
  end loop;

  insert into public.salon_licenses (license_key, plan, customer_name, customer_email, customer_phone)
  values (
    v_key,
    coalesce(nullif(btrim(p_plan), ''), 'standard'),
    nullif(btrim(p_customer_name), ''),
    nullif(btrim(p_customer_email), ''),
    nullif(btrim(p_customer_phone), '')
  );

  return v_key;
end;
$$;

revoke all on function public.issue_salon_license(text, text, text, text) from public;
revoke all on function public.issue_salon_license(text, text, text, text) from anon, authenticated;
grant execute on function public.issue_salon_license(text, text, text, text) to service_role;

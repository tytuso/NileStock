-- NileStock v10.2.4: durable, per-sale records for safe cross-device merging.
-- Run this in the same Nile Core Supabase project before deploying v10.2.4.

create table if not exists public.nilestock_sales (
  business_id uuid not null
    references public.nilestock_businesses(id) on delete cascade,
  id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null,
  updated_by uuid
    references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (business_id, id)
);

create index if not exists nilestock_sales_business_created_idx
  on public.nilestock_sales(business_id, created_at desc);
create index if not exists nilestock_sales_updated_by_idx
  on public.nilestock_sales(updated_by);

grant select, insert, update on public.nilestock_sales to authenticated;
revoke all on public.nilestock_sales from anon;

alter table public.nilestock_sales enable row level security;
alter table public.nilestock_sales force row level security;

drop policy if exists nilestock_sales_member_select on public.nilestock_sales;
drop policy if exists nilestock_sales_member_insert on public.nilestock_sales;
drop policy if exists nilestock_sales_member_update on public.nilestock_sales;

create policy nilestock_sales_member_select
  on public.nilestock_sales
  for select
  to authenticated
  using (public.nilestock_is_member(business_id));

create policy nilestock_sales_member_insert
  on public.nilestock_sales
  for insert
  to authenticated
  with check (
    public.nilestock_is_member(business_id)
    and updated_by = (select auth.uid())
  );

create policy nilestock_sales_member_update
  on public.nilestock_sales
  for update
  to authenticated
  using (public.nilestock_is_member(business_id))
  with check (
    public.nilestock_is_member(business_id)
    and updated_by = (select auth.uid())
  );

-- Founder-safe plan management and Pro AI usage tracking.

create table if not exists public.nilestock_ai_usage (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.nilestock_businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists nilestock_ai_usage_business_created_idx
  on public.nilestock_ai_usage(business_id, created_at desc);
create index if not exists nilestock_ai_usage_user_idx
  on public.nilestock_ai_usage(user_id);

alter table public.nilestock_ai_usage enable row level security;
grant select, insert on public.nilestock_ai_usage to authenticated;

drop policy if exists nilestock_ai_usage_member_select on public.nilestock_ai_usage;
drop policy if exists nilestock_ai_usage_self_insert on public.nilestock_ai_usage;
create policy nilestock_ai_usage_member_select
  on public.nilestock_ai_usage for select
  to authenticated
  using (public.nilestock_is_member(business_id));
create policy nilestock_ai_usage_self_insert
  on public.nilestock_ai_usage for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.nilestock_is_member(business_id)
  );

create or replace function public.nilestock_guard_plan_access()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    new.plan is distinct from old.plan
    or new.status is distinct from old.status
  ) and lower(coalesce((select auth.jwt() ->> 'email'), '')) <> 'opiotitus333@gmail.com' then
    raise exception 'Only the NileStock founder can change plan access';
  end if;
  return new;
end;
$$;

revoke all on function public.nilestock_guard_plan_access() from public, anon;

-- Resolve the founder workspace before the guard trigger is installed.
update public.nilestock_businesses
set plan = 'pro', updated_at = now()
where created_by in (
  select id from auth.users where lower(email) = 'opiotitus333@gmail.com'
);

drop trigger if exists nilestock_guard_plan_access_trigger
  on public.nilestock_businesses;
create trigger nilestock_guard_plan_access_trigger
before update on public.nilestock_businesses
for each row execute function public.nilestock_guard_plan_access();

drop policy if exists nilestock_businesses_member_select on public.nilestock_businesses;
drop policy if exists nilestock_businesses_owner_update on public.nilestock_businesses;
drop policy if exists nilestock_businesses_founder_select on public.nilestock_businesses;
drop policy if exists nilestock_businesses_founder_update on public.nilestock_businesses;

create policy nilestock_businesses_member_select
  on public.nilestock_businesses for select
  to authenticated
  using (public.nilestock_is_member(id));
create policy nilestock_businesses_owner_update
  on public.nilestock_businesses for update
  to authenticated
  using (public.nilestock_has_role(id, array['owner']))
  with check (public.nilestock_has_role(id, array['owner']));
create policy nilestock_businesses_founder_select
  on public.nilestock_businesses for select
  to authenticated
  using (lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'opiotitus333@gmail.com');
create policy nilestock_businesses_founder_update
  on public.nilestock_businesses for update
  to authenticated
  using (lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'opiotitus333@gmail.com')
  with check (lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'opiotitus333@gmail.com');

drop policy if exists nilestock_profiles_founder_select on public.nilestock_profiles;
create policy nilestock_profiles_founder_select
  on public.nilestock_profiles for select
  to authenticated
  using (lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'opiotitus333@gmail.com');

grant update(name, plan, status, updated_at)
  on public.nilestock_businesses to authenticated;

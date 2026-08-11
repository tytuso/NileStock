-- NileStock cloud authentication and workspace storage for the shared Nile Core project.
-- Every object is prefixed so NileStock remains isolated from Zabuni and NileFlow.

create extension if not exists pgcrypto;

create table if not exists public.nilestock_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nilestock_businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free' check (plan in ('free','starter','business','pro')),
  status text not null default 'active' check (status in ('active','revoked')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nilestock_business_members (
  business_id uuid not null references public.nilestock_businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','manager','cashier')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table if not exists public.nilestock_workspace_data (
  business_id uuid primary key references public.nilestock_businesses(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.nilestock_billing_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.nilestock_businesses(id) on delete cascade,
  requested_plan text not null check (requested_plan in ('starter','business','pro')),
  billing_cycle text not null check (billing_cycle in ('monthly','annual')),
  payment_method text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nilestock_members_user_idx
  on public.nilestock_business_members(user_id, status);
create index if not exists nilestock_billing_business_idx
  on public.nilestock_billing_requests(business_id, created_at desc);

create or replace function public.nilestock_is_member(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.nilestock_business_members
    where business_id = bid and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.nilestock_has_role(bid uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.nilestock_business_members
    where business_id = bid
      and user_id = auth.uid()
      and status = 'active'
      and role = any(allowed_roles)
  );
$$;

create or replace function public.ensure_nilestock_business(p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  bid uuid;
  profile_name text;
  profile_email text;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  profile_name := coalesce(
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'name'), ''),
    split_part(coalesce(auth.jwt() ->> 'email', 'Shop Owner'), '@', 1)
  );
  profile_email := auth.jwt() ->> 'email';

  insert into public.nilestock_profiles(id, full_name, email)
  values (uid, profile_name, profile_email)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        updated_at = now();

  select business_id into bid
  from public.nilestock_business_members
  where user_id = uid and status = 'active'
  order by created_at
  limit 1;

  if bid is null then
    insert into public.nilestock_businesses(name, created_by)
    values (
      coalesce(
        nullif(trim(p_name), ''),
        nullif(trim(auth.jwt() -> 'user_metadata' ->> 'business_name'), ''),
        profile_name || '''s Shop'
      ),
      uid
    )
    returning id into bid;

    insert into public.nilestock_business_members(business_id, user_id, role)
    values (bid, uid, 'owner');

    insert into public.nilestock_workspace_data(business_id, updated_by)
    values (bid, uid);
  end if;

  return bid;
end;
$$;

grant execute on function public.ensure_nilestock_business(text) to authenticated;
grant execute on function public.nilestock_is_member(uuid) to authenticated;
grant execute on function public.nilestock_has_role(uuid, text[]) to authenticated;
grant select, update on public.nilestock_profiles to authenticated;
grant select, update on public.nilestock_businesses to authenticated;
grant select, insert, update, delete on public.nilestock_business_members to authenticated;
grant select, insert, update on public.nilestock_workspace_data to authenticated;
grant select, insert, update on public.nilestock_billing_requests to authenticated;

alter table public.nilestock_profiles enable row level security;
alter table public.nilestock_businesses enable row level security;
alter table public.nilestock_business_members enable row level security;
alter table public.nilestock_workspace_data enable row level security;
alter table public.nilestock_billing_requests enable row level security;

create policy nilestock_profiles_self_select
  on public.nilestock_profiles for select
  using (id = auth.uid());
create policy nilestock_profiles_self_update
  on public.nilestock_profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy nilestock_businesses_member_select
  on public.nilestock_businesses for select
  using (public.nilestock_is_member(id));
create policy nilestock_businesses_owner_update
  on public.nilestock_businesses for update
  using (public.nilestock_has_role(id, array['owner']))
  with check (public.nilestock_has_role(id, array['owner']));

create policy nilestock_members_member_select
  on public.nilestock_business_members for select
  using (public.nilestock_is_member(business_id));
create policy nilestock_members_owner_insert
  on public.nilestock_business_members for insert
  with check (public.nilestock_has_role(business_id, array['owner']));
create policy nilestock_members_owner_update
  on public.nilestock_business_members for update
  using (public.nilestock_has_role(business_id, array['owner']))
  with check (public.nilestock_has_role(business_id, array['owner']));
create policy nilestock_members_owner_delete
  on public.nilestock_business_members for delete
  using (public.nilestock_has_role(business_id, array['owner']));

create policy nilestock_workspace_member_select
  on public.nilestock_workspace_data for select
  using (public.nilestock_is_member(business_id));
create policy nilestock_workspace_member_insert
  on public.nilestock_workspace_data for insert
  with check (public.nilestock_is_member(business_id));
create policy nilestock_workspace_member_update
  on public.nilestock_workspace_data for update
  using (public.nilestock_is_member(business_id))
  with check (public.nilestock_is_member(business_id));

create policy nilestock_billing_member_select
  on public.nilestock_billing_requests for select
  using (public.nilestock_is_member(business_id));
create policy nilestock_billing_owner_insert
  on public.nilestock_billing_requests for insert
  with check (
    requested_by = auth.uid()
    and public.nilestock_has_role(business_id, array['owner'])
  );
create policy nilestock_billing_owner_update
  on public.nilestock_billing_requests for update
  using (public.nilestock_has_role(business_id, array['owner']))
  with check (public.nilestock_has_role(business_id, array['owner']));

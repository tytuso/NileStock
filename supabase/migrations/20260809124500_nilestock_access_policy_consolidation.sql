-- Consolidate founder/member policies so each operation evaluates one policy.

drop policy if exists nilestock_businesses_member_select on public.nilestock_businesses;
drop policy if exists nilestock_businesses_founder_select on public.nilestock_businesses;
drop policy if exists nilestock_businesses_owner_update on public.nilestock_businesses;
drop policy if exists nilestock_businesses_founder_update on public.nilestock_businesses;

create policy nilestock_businesses_member_or_founder_select
  on public.nilestock_businesses for select
  to authenticated
  using (
    public.nilestock_is_member(id)
    or lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'opiotitus333@gmail.com'
  );

create policy nilestock_businesses_owner_or_founder_update
  on public.nilestock_businesses for update
  to authenticated
  using (
    public.nilestock_has_role(id, array['owner'])
    or lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'opiotitus333@gmail.com'
  )
  with check (
    public.nilestock_has_role(id, array['owner'])
    or lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'opiotitus333@gmail.com'
  );

drop policy if exists nilestock_profiles_self_select on public.nilestock_profiles;
drop policy if exists nilestock_profiles_founder_select on public.nilestock_profiles;
create policy nilestock_profiles_self_or_founder_select
  on public.nilestock_profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'opiotitus333@gmail.com'
  );

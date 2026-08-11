-- Tighten function privileges and add indexes identified by Supabase advisors.

revoke all on function public.ensure_nilestock_business(text) from public, anon;
revoke all on function public.nilestock_is_member(uuid) from public, anon;
revoke all on function public.nilestock_has_role(uuid, text[]) from public, anon;

grant execute on function public.ensure_nilestock_business(text) to authenticated;
grant execute on function public.nilestock_is_member(uuid) to authenticated;
grant execute on function public.nilestock_has_role(uuid, text[]) to authenticated;

drop policy if exists nilestock_profiles_self_select on public.nilestock_profiles;
drop policy if exists nilestock_profiles_self_update on public.nilestock_profiles;
drop policy if exists nilestock_billing_owner_insert on public.nilestock_billing_requests;

create policy nilestock_profiles_self_select
  on public.nilestock_profiles for select
  using (id = (select auth.uid()));
create policy nilestock_profiles_self_update
  on public.nilestock_profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy nilestock_billing_owner_insert
  on public.nilestock_billing_requests for insert
  with check (
    requested_by = (select auth.uid())
    and public.nilestock_has_role(business_id, array['owner'])
  );

create index if not exists nilestock_businesses_creator_idx
  on public.nilestock_businesses(created_by);
create index if not exists nilestock_workspace_updated_by_idx
  on public.nilestock_workspace_data(updated_by);
create index if not exists nilestock_billing_requested_by_idx
  on public.nilestock_billing_requests(requested_by);


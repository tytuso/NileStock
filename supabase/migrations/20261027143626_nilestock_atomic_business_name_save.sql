-- Keep the business name and workspace snapshot consistent, including for
-- installed clients that never awaited their separate business UPDATE.
create or replace function public.nilestock_save_workspace(
  p_business_id uuid,
  p_payload jsonb,
  p_expected_revision bigint
)
returns table (revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.nilestock_is_member(p_business_id) then
    raise exception 'NileStock business access is required';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'NileStock workspace payload must be a JSON object';
  end if;
  if nullif(btrim(p_payload -> 'business' ->> 'name'), '') is null then
    raise exception 'A business name is required';
  end if;

  update public.nilestock_workspace_data
  set payload = p_payload,
      updated_by = auth.uid(),
      updated_at = now(),
      revision = public.nilestock_workspace_data.revision + 1
  where business_id = p_business_id
    and public.nilestock_workspace_data.revision = p_expected_revision
  returning public.nilestock_workspace_data.revision,
            public.nilestock_workspace_data.updated_at
    into revision, updated_at;

  if not found then
    return; -- A stale revision cannot rename the business either.
  end if;

  -- Staff can sync sales as before. Only the owner can rename the business.
  -- Plan and access status are deliberately excluded from this update.
  if public.nilestock_has_role(p_business_id, array['owner']) then
    update public.nilestock_businesses
    set name = p_payload -> 'business' ->> 'name', updated_at = now()
    where id = p_business_id
      and name is distinct from (p_payload -> 'business' ->> 'name');
  end if;
  return next;
end;
$$;

revoke all on function public.nilestock_save_workspace(uuid, jsonb, bigint)
  from public, anon;
grant execute on function public.nilestock_save_workspace(uuid, jsonb, bigint)
  to authenticated;

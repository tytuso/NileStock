-- Fix the revision comparison in the workspace save function.
-- Run after 20260826120000_nilestock_workspace_realtime_sync.sql.

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
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'NileStock workspace payload must be a JSON object';
  end if;

  update public.nilestock_workspace_data
  set
    payload = p_payload,
    updated_by = auth.uid(),
    updated_at = now(),
    revision = public.nilestock_workspace_data.revision + 1
  where business_id = p_business_id
    and public.nilestock_workspace_data.revision = p_expected_revision
  returning public.nilestock_workspace_data.revision,
            public.nilestock_workspace_data.updated_at
    into revision, updated_at;

  if found then
    return next;
  end if;
  return;
end;
$$;

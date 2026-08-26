-- NileStock workspace sync: optimistic revisions + Realtime publication.
-- Apply this migration before deploying the matching entry.tsx change.

alter table public.nilestock_workspace_data
  add column if not exists revision bigint not null default 0;

-- Existing rows begin at revision 0. Every accepted save advances the value,
-- so a client can never replace a snapshot based on an older revision.
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
    and revision = p_expected_revision
  returning public.nilestock_workspace_data.revision,
            public.nilestock_workspace_data.updated_at
    into revision, updated_at;

  if found then
    return next;
  end if;
  return;
end;
$$;

revoke all on function public.nilestock_save_workspace(uuid, jsonb, bigint)
  from public, anon;
grant execute on function public.nilestock_save_workspace(uuid, jsonb, bigint)
  to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.nilestock_workspace_data;
exception
  when duplicate_object then null;
end;
$$;

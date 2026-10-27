-- Run against a database with the NileStock migrations applied. Every fixture
-- is rolled back; no customer workspace or account is edited.
begin;
do $$
declare
  test_owner uuid;
  test_business uuid := gen_random_uuid();
  saved_revision bigint;
  row_count bigint;
  rejected boolean;
  payload jsonb := '{"business":{"name":"NileStock QA renamed","plan":"pro"}}'::jsonb;
begin
  select user_id into test_owner from public.nilestock_business_members
  where role = 'owner' and status = 'active' limit 1;
  if test_owner is null then raise exception 'An existing owner is needed for this rollback-only fixture'; end if;

  insert into public.nilestock_businesses(id, name, created_by)
  values (test_business, 'NileStock QA original', test_owner);
  insert into public.nilestock_business_members(business_id, user_id, role)
  values (test_business, test_owner, 'owner');
  insert into public.nilestock_workspace_data(business_id, payload, updated_by)
  values (test_business, '{"business":{"name":"NileStock QA original"}}', test_owner);
  perform set_config('request.jwt.claim.sub', test_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', test_owner, 'role', 'authenticated')::text, true);

  select revision into saved_revision from public.nilestock_save_workspace(test_business, payload, 0);
  if saved_revision is distinct from 1 then raise exception 'Save did not advance revision'; end if;
  if (select name from public.nilestock_businesses where id=test_business) is distinct from 'NileStock QA renamed'
    or (select w.payload -> 'business' ->> 'name' from public.nilestock_workspace_data w where business_id=test_business) is distinct from 'NileStock QA renamed'
    then raise exception 'Business name and workspace were not saved together'; end if;
  if (select plan from public.nilestock_businesses where id=test_business) <> 'free'
    then raise exception 'A workspace save changed the subscription plan'; end if;

  select count(*) into row_count from public.nilestock_save_workspace(test_business, jsonb_set(payload, '{business,name}', '"Stale overwrite"'), 0);
  if row_count <> 0 or (select name from public.nilestock_businesses where id=test_business) <> 'NileStock QA renamed'
    then raise exception 'A stale revision overwrote the business name'; end if;

  rejected := false;
  begin
    perform public.nilestock_save_workspace(test_business, jsonb_set(payload, '{business,name}', '"   "'), 1);
  exception when others then rejected := sqlerrm = 'A business name is required'; end;
  if not rejected then raise exception 'A blank business name was accepted'; end if;

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  rejected := false;
  begin
    perform public.nilestock_save_workspace(test_business, payload, 1);
  exception when others then rejected := sqlerrm = 'NileStock business access is required'; end;
  if not rejected then raise exception 'A non-member could save the business'; end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  rejected := false;
  begin
    perform public.nilestock_save_workspace(test_business, payload, 1);
  exception when others then rejected := sqlerrm = 'NileStock business access is required'; end;
  if not rejected then raise exception 'An unauthenticated call was accepted'; end if;
  if has_function_privilege('anon', 'public.nilestock_save_workspace(uuid,jsonb,bigint)', 'EXECUTE')
    then raise exception 'Anonymous execution is allowed'; end if;
  if not has_function_privilege('authenticated', 'public.nilestock_save_workspace(uuid,jsonb,bigint)', 'EXECUTE')
    then raise exception 'Authenticated save permission is missing'; end if;
end;
$$;
rollback;
select 'PASS: atomic rename, revision conflict, blank-name validation, plan protection, membership and anonymous access checks' as result;

CREATE OR REPLACE FUNCTION public.nilestock_guard_plan_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if (
    new.plan is distinct from old.plan
    or new.status is distinct from old.status
  ) and lower(coalesce((select auth.jwt() ->> 'email'), '')) not in ('opiotitus333@gmail.com','oyagoisaac7@gmail.com') then
    raise exception 'Only the NileStock founder can change plan access';
  end if;
  return new;
end;
$function$;
ALTER POLICY "nilestock_businesses_member_or_founder_select" ON "public"."nilestock_businesses" USING ((nilestock_is_member(id) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = ANY (ARRAY['opiotitus333@gmail.com'::text, 'oyagoisaac7@gmail.com'::text]))));
ALTER POLICY "nilestock_businesses_owner_or_founder_update" ON "public"."nilestock_businesses" USING ((nilestock_has_role(id, ARRAY['owner'::text]) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = ANY (ARRAY['opiotitus333@gmail.com'::text, 'oyagoisaac7@gmail.com'::text])))) WITH CHECK ((nilestock_has_role(id, ARRAY['owner'::text]) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = ANY (ARRAY['opiotitus333@gmail.com'::text, 'oyagoisaac7@gmail.com'::text]))));
ALTER POLICY "nilestock_profiles_self_or_founder_select" ON "public"."nilestock_profiles" USING (((id = ( SELECT auth.uid() AS uid)) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = ANY (ARRAY['opiotitus333@gmail.com'::text, 'oyagoisaac7@gmail.com'::text]))));
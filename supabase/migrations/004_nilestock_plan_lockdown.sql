-- Customers may rename their business and request upgrades, but cannot grant
-- themselves a paid plan or approve their own billing request.

revoke update on public.nilestock_businesses from authenticated;
grant update(name, updated_at) on public.nilestock_businesses to authenticated;

revoke update on public.nilestock_billing_requests from authenticated;
drop policy if exists nilestock_billing_owner_update
  on public.nilestock_billing_requests;


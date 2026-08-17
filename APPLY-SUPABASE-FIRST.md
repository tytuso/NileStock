# NileStock database note for v10.3.1

The cross-device sales fix uses one RLS-protected table in Nile Core. **For the current live NileStock project this migration has already been applied, so do not treat it as a new v10.3.1 requirement.** Keep this file for fresh environments or disaster recovery.

1. Open **Supabase → Nile Core → SQL Editor → New query**.
2. Open `supabase/migrations/20260811143000_nilestock_cross_device_sales.sql` from this ZIP, copy all of it into the query, and click **Run** once.
3. Confirm the query finishes successfully. It is safe to run again because the table and indexes use `if not exists`, while policies are recreated deliberately.
4. Push the remaining ZIP contents to the GitHub `main` branch and let Vercel build production.
5. On phone A, make one test sale. On phone B, sign into the same account/business and confirm the receipt appears after app focus/reconnection. A manual refresh should not be required for the new auto-sync path.

Do not add a service-role key to Vercel or to any `NEXT_PUBLIC_` variable. The app uses the signed-in Supabase user and Row Level Security.

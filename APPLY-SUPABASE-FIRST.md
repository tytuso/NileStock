# Apply the NileStock v10.2.4 database update first

The cross-device sales fix needs one new, RLS-protected table in the existing Nile Core Supabase project.

1. Open **Supabase → Nile Core → SQL Editor → New query**.
2. Open `supabase/migrations/20260811143000_nilestock_cross_device_sales.sql` from this ZIP, copy all of it into the query, and click **Run** once.
3. Confirm the query finishes successfully. It is safe to run again because the table and indexes use `if not exists`, while policies are recreated deliberately.
4. Push the remaining ZIP contents to the GitHub `main` branch and let Vercel build production.
5. On phone A, make one test sale. On phone B, sign into the same account/business and refresh. Confirm the new receipt appears and stock is reduced once.

Do not add a service-role key to Vercel or to any `NEXT_PUBLIC_` variable. The app uses the signed-in Supabase user and Row Level Security.

# NileStock deployment

## 1. Prepare Supabase

- Use the connected **Nile Core** project or create a dedicated Supabase project.
- For Nile Core, run every `nilestock_` migration in filename order. **For v10.2.4, run `supabase/migrations/20260811143000_nilestock_cross_device_sales.sql` before deploying the code.**
- The Nile Core Authentication Site URL may remain shared with another Nile app because NileStock always supplies and validates its own `redirectTo` URL.
- In **Authentication → URL Configuration → Redirect URLs**, add `http://localhost:3000/**`, `https://nilestock.vercel.app/**`, `https://*-titus-projects-4a3cc808.vercel.app/**`, and production `https://nilestock.nileai.solutions/**`. The team wildcard is required for Google sign-in from Vercel preview deployments.
- Keep the existing Google provider enabled; its Supabase callback is shared safely with Zabuni.
- Keep Row Level Security enabled. Do not add permissive `anon` policies.

## 2. Push to GitHub

Create a private repository, commit the extracted contents, and push the main branch. Do not commit `.env.local`.

## 3. Deploy on Vercel

1. In Vercel, select **Add New → Project** and import the repository.
2. Framework preset: **Next.js**. Build command: `npm run build`. Output settings: default.
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL=https://nilestock.vercel.app` (replace with the custom NileStock domain after it is connected)
   - `NEXT_PUBLIC_FOUNDER_EMAIL=your-private-founder-email`
   - `OPENAI_API_KEY` (server-only; never prefix with `NEXT_PUBLIC_`)
   - `OPENAI_MODEL=gpt-5.6-luna`
4. Deploy.
5. Add `nilestock.nileai.solutions` under **Project → Settings → Domains** and apply the DNS record Vercel provides only when the verified preview is ready to promote.
6. Return to Supabase Auth URL Configuration and confirm the final custom-domain URL.

## 4. Validate before accepting real sales

- Sign up two test owners and create two businesses.
- Confirm neither account can read the other's products or sales.
- Create a product, generate and scan its code twice, and verify quantity/total.
- Complete cash and customer-credit sales; verify stock, payments and customer balances.
- On phone A, complete a sale. Refresh phone B while signed into the same business and confirm the receipt appears and stock changes only once.
- Disconnect phone A, complete a test sale, reconnect and confirm its pending status changes only after the per-sale Supabase write succeeds.
- Sign into a different test business and confirm it cannot read the first business's receipts.
- Receive a purchase and verify stock increases and supplier balance.
- Refund a test sale and verify the original record remains and stock returns.
- Print 58mm/80mm/A4 receipts and code sheets using the target hardware.
- Test Android Chrome and iPhone Safari camera permissions and PWA installation.

## 5. Operational recommendations

- Enable Supabase point-in-time recovery or scheduled backups before meaningful production volume.
- Use a custom SMTP sender for authentication emails.
- Set up error monitoring only if desired; NileStock core does not require it.
- Never place a service-role key in a `NEXT_PUBLIC_` variable.

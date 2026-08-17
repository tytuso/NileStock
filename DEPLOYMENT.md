# NileStock v10.3.1 deployment — nilestock.shop

## 1. Keep the working production database

NileStock continues to use the existing `nilestock_` tables in Nile Core. The cross-device sales migration `20260811143000_nilestock_cross_device_sales.sql` is already part of this bundle. If it is already applied in production, **do not apply it again just because you changed domains**.

The customer-facing Starter plan was renamed **Lite** and repriced to UGX 9,500, but its internal database ID remains `starter`. That means the new pricing does **not** require a database plan migration.

## 2. Local test before replacing production

```powershell
npm install
npm run typecheck
npm test
npm run dev
```

Open `http://localhost:3000`. Test sign-in, product creation, one sale, receipt PDF, barcode/QR preview, Billing and the Help page. For phone camera testing, use the production HTTPS domain rather than a plain LAN HTTP URL.

## 3. Push this release to GitHub

After the local checks pass, commit the v10.3.1 files to the NileStock repository. Do not commit `.env.local`.

## 4. Vercel environment variables

Keep the existing Supabase values and set:

```env
NEXT_PUBLIC_SITE_URL=https://nilestock.shop
NEXT_PUBLIC_FOUNDER_EMAIL=your-founder-email
```

Also keep `OPENAI_API_KEY` and `OPENAI_MODEL` only if Pro AI is enabled. Never expose service-role or AI secrets with a `NEXT_PUBLIC_` prefix.

## 5. Connect nilestock.shop

1. In Vercel open the NileStock project → **Settings → Domains**.
2. Add `nilestock.shop`.
3. Also add `www.nilestock.shop` and configure it to redirect to the apex domain if Vercel offers that option.
4. Vercel will display the DNS records it expects.
5. In Hostinger → Domains → `nilestock.shop` → DNS / Nameservers, add **the exact records Vercel shows**. Do not guess an A-record IP from an old tutorial.
6. Wait until Vercel marks the domain valid and HTTPS is issued.

The current product combines marketing, sign-in and the authenticated app, so **no `app.nilestock.shop` subdomain is required now**. Use the valuable short apex domain for the whole product. A separate `app.` subdomain only becomes useful later if the marketing website and product are split into different deployments.

## 6. Supabase authentication URLs

In Supabase → Authentication → URL Configuration:

- Site URL: `https://nilestock.shop`
- Redirect URL: `https://nilestock.shop/**`
- Optional redirect: `https://www.nilestock.shop/**`
- Keep `http://localhost:3000/**` for local development.
- Keep any Vercel preview URL patterns you actively use for testing.

Google sign-in still returns through Supabase's OAuth callback; changing the public NileStock domain does not mean creating a new Google callback that bypasses Supabase.

## 7. Production smoke test

- Open `https://nilestock.shop` on desktop.
- Open it on iPhone Safari and Android Chrome.
- Sign in and confirm the same workspace loads.
- Complete a sale on one device and confirm it syncs to the other without a manual browser refresh after reconnection/focus.
- Go offline after one successful online load, complete a test sale, reconnect and verify it syncs.
- Generate a product with a blank barcode and confirm NileStock creates a code/QR value.
- Test the existing camera scanner on iPhone without applying the experimental camera patch that previously caused instability.
- Download/share one receipt and one allowed report.
- Check `/robots.txt`, `/sitemap.xml`, `/privacy` and `/terms`.

## 8. Search launch

After the domain is live, add `https://nilestock.shop` to Google Search Console and submit `https://nilestock.shop/sitemap.xml`. Search indexing is not instant; the technical SEO files only make the site eligible and easier to crawl.

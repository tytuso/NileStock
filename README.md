# NileStock v10.2.7

## v10.2.7 premium receipts

- Redesigned on-screen and PDF receipts with clear receipt details, item columns, totals and payment panels.
- Uses the business initials as the receipt emblem instead of presenting NileStock as the seller.
- Shows `Prepared by`, customer identity, an `N` negotiated-price marker and a readable marker legend.
- Keeps 58mm, 80mm and A4 printing, PDF download, native sharing and WhatsApp PDF handoff.
- Includes a project-local Vitest configuration so tests do not load unrelated parent-drive Vite files on Windows.

## v10.2.6 polished PDF reports

- Redesigned downloadable business reports with modern NileStock branding, structured KPI cards, a clear report summary and a bordered transaction table.
- Added automatic table pagination with repeated report context on continuation pages.
- Fixed the overlapping footer by rendering one balanced footer per page with business identity, NileStock branding and page numbering in separate columns.
- Upgraded the Sales-page PDF export to use the same polished report system.

## v10.2.5 optional negotiated pricing

- Normal product prices and checkout continue to work exactly as before.
- A cashier may activate **Negotiate price** for an individual cart product, then enter the agreed selling price.
- Turning negotiation off restores the product's original listed price.
- Negotiated items carry a small **NEG** marker in the cart, saved sale, printed receipt and PDF receipt.
- Negotiated pricing is included in existing cross-device sale payloads. No new Supabase migration is required after the v10.2.4 sales migration has been applied.

## v10.2.4 cross-device and cashier update

- Each sale is now stored as its own protected Supabase record. A refresh, app focus, or restored connection merges receipts created on another phone without deducting stock twice.
- Existing receipts are backfilled automatically on the first successful v10.2.4 sync. Offline receipts remain local and show pending until Supabase confirms their upload.
- New receipts use the signed-in account name (or email when no useful name exists) as the cashier. Checkout includes an editable **Cashier name on receipt** field for an intentional override.
- Apply `supabase/migrations/20260811143000_nilestock_cross_device_sales.sql` to Nile Core before deploying this version.

## v10.2.3 final-build notes

- New and unconfigured workspaces open in light mode. A user can still deliberately choose Light, Dark or System in Settings.
- New receipts use the sale's local date and time, beginning with the requested format such as `NS-2026-1008-4PM`. Minutes and seconds appear only when needed, and an uncommon same-second duplicate receives a short numeric suffix.
- The receipt number is reused consistently in sales history, receipt history, printing, PDFs, filenames, reports, WhatsApp sharing, inventory movements and the audit log.

NileStock is a premium, responsive retail operating system for small shops: rapid POS, inventory ledger, purchasing, suppliers, customers and credit, expenses, reports, staff shifts, audit history, receipt printing/PDF/WhatsApp sharing, barcode/QR generation, code-sheet PDFs, camera and physical-scanner support, PWA caching, and offline sale queue status.

## Quick local setup

1. Install Node.js 20.9 or newer.
2. Extract the project and open a terminal in its directory.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local` if you need to override the connected Nile Core project.
5. Run `npm run dev`.
6. Open `http://localhost:3000`.

### Activate the AI Adviser locally

Create `.env.local` beside `package.json` and add:

```env
OPENAI_API_KEY=your-real-openai-api-key
OPENAI_MODEL=gpt-5.6-luna
```

Stop and restart `npm run dev` after saving the file. Keep `.env.local` private; it is already excluded from Git and the project ZIP.

### Open NileStock on your phone during development

1. Connect the computer and phone to the same Wi-Fi network.
2. Run `npm run dev:phone` and keep that terminal open.
3. Open the **Network** URL printed by Next.js on the phone. Do not use `localhost` on the phone.
4. If the printed address does not work, run `ipconfig` on Windows, find **Wireless LAN adapter Wi-Fi → IPv4 Address**, and open `http://THAT-IP:3000` on the phone.
5. When Windows Firewall asks, allow Node.js on **Private networks**. Temporarily disconnect a VPN if it replaces the Wi-Fi address.

The PWA install button appears when the browser supports the install prompt. On iPhone, use Safari **Share → Add to Home Screen**.

The **Preview workspace** button remains local-only for safe evaluation. Real email/password and Google sessions use Supabase and sync their isolated business workspace to Nile Core. No paid API is used by POS, scanning, codes, receipts, or on-screen reports. AI is an optional Pro-only service.

## v10.1 restoration notes

- Product changes are backed up immediately in a business-specific browser workspace, then synced to Supabase. On the next sign-in NileStock selects the newest safe copy, preventing an older cloud response from hiding recently added products. The first v10.1 sign-in also recovers matching products from the older v3 browser store when the cloud catalogue is empty.
- Signing out now makes one final workspace save before ending the cloud session.
- Products can be searched by name, SKU, barcode or category and exported as an Excel-compatible UTF-8 CSV.
- Inventory has its own product/SKU/barcode/category search, including matching ledger activity.
- Stock adjustment supports Add/Remove controls with an optional reason.
- The AI adviser uses a smaller live-business context, reduced conversation history, no unnecessary reasoning delay and a 20-second first-response cutoff with a clear retry message.
- Receipt printing and PDF export keep custom footer text and NileStock branding on separate lines, wrap long text, and avoid duplicate branding.

## Supabase setup

1. NileStock currently uses the existing **Nile Core** Supabase project shared with Zabuni.
2. Apply the shared-project migrations in filename order, including `20260811143000_nilestock_cross_device_sales.sql`. All objects use a `nilestock_` prefix.
3. In **Authentication → Providers → Google**, keep Google enabled as it is for Zabuni.
4. In **Authentication → URL Configuration**, add `http://localhost:3000/**`, `https://nilestock.vercel.app/**`, and the final NileStock domain to Redirect URLs.
5. If moving NileStock to another project, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` and Vercel.
6. Never expose the service-role key to the browser.

### Shared Nile Core authentication email

Supabase authentication email templates are configured once for the entire **Nile Core** project, so a NileStock-only template would also affect Zabuni. NileStock signup now stores `app_name: "nilestock"` in the user's authentication metadata. The file `supabase/email-templates/shared-confirm-signup.html` contains conditional NileStock, Zabuni and neutral fallback designs.

Do not install the old NileStock-only email template. Before activating the shared template, update Zabuni signup to store `app_name: "zabuni"`, use the neutral subject **Confirm your Nile AI Solutions account**, and paste the shared template into **Authentication → Email Templates → Confirm sign up**. Until Zabuni sends that marker, leave the existing Nile Core template unchanged.

`ensure_nilestock_business()` creates a profile, business, owner membership and empty workspace only after an authenticated user enters NileStock. Row Level Security limits every workspace to active business members. Customers can request paid plans but cannot grant or approve their own plan. Migration `001_nilestock.sql` is the expanded standalone relational schema for a future dedicated NileStock project; do not apply its unprefixed tables to Nile Core.

## Production checks

```bash
npm run typecheck
npm test
npm run build
npm start
```

## Deploy to Vercel

See [DEPLOYMENT.md](DEPLOYMENT.md). The application works without external image/CDN or paid transaction services. Supabase free-tier capacity may be suitable for early use; review its current limits before launch.

## Key workflows

- **Fast sale:** Open Sale, scan/enter a barcode or tap a product, then Pay. Repeated scans increase quantity and totals update instantly.
- **Generated codes:** Products without a code receive a unique local Code 128 value. Open Codes to preview barcodes or QR codes, choose 4/9/16/25 codes per A4 page, download images, print labels, or export a selected-product PDF.
- **Bulk product import/export:** Products → Import products accepts CSV. `product_name` and `selling_price` are required; category, cost, SKU, barcode, opening stock, reorder level, unit and description are optional. A downloadable template is included. Products → Export CSV creates a file that opens directly in Excel.
- **Stock accountability:** Product creation, purchase receipt, sales, refunds, adjustments, and stocktakes create ledger movements.
- **Receipts:** Every sale creates a retained receipt in Sales. Print with thermal/A4 styles, create a real PDF, use native sharing, or open a prefilled WhatsApp message.
- **Customer debt:** Select Customer Credit at checkout and a customer. Record later repayment from Customers; repayment is not mixed with sales revenue.
- **Offline and multiple phones:** The service worker caches the app shell. Browser-held data remains available; sales completed offline stay pending until the per-sale Supabase upsert succeeds. Signing in to the same business on another phone downloads and safely merges those confirmed receipts.
- **Customer requests:** Record products customers wanted but could not find, track sourcing status, and export a purchasing PDF.
- **Report centre:** Every plan can read current daily, weekly, monthly, profit, inventory, expense, credit, supplier and request reports. Business and Pro accounts unlock branded PDF downloads and WhatsApp sharing.
- **AI adviser:** Pro accounts can ask business evaluation, strategy, product opportunity and stock questions grounded in live NileStock records. Contact details are excluded from the model context.
- **Plan page:** Every account can see its current plan, included access and the benefits available in higher tiers.
- **Founder control:** Set `NEXT_PUBLIC_FOUNDER_EMAIL` to the founder login email. The founder can draft plan/status changes and persist them with **Save access**; database policies and a trigger prevent ordinary owners from granting themselves plans.

## Plans and feature rules

- **Free — UGX 0:** Up to 10 products, core POS/receipts and readable live reports.
- **Starter — UGX 25,000/month:** Unlimited products, barcode/QR downloads, customer requests and WhatsApp receipts.
- **Business — UGX 50,000/month:** Staff/shifts, suppliers, customer credit, purchases, CSV exports and branded PDF reports.
- **Pro — UGX 100,000/month:** Everything in Business plus the AI Business Adviser, business evaluation, product opportunities and strategic insights.

Starter/Business/Pro access is approved from the private Founder page after a billing request is verified.

The dashboard includes a responsive **Billing** centre with monthly/annual pricing, two-month annual savings, current-plan status, feature comparison and structured Mobile Money, bank or card activation requests. The database migration includes `subscriptions` and `billing_requests` tables ready for a future Pesapal/payment-webhook integration. Until payment credentials are configured, upgrade requests are handed to NileStock support for confirmation instead of pretending an unverified payment succeeded.

The **Sales** page supports From/To date filtering, exact sale date and time, date-filtered CSV export, and a branded PDF sales report with the selected-period total.

Low-stock alerts default to 2 units. Settings → Automatic low-stock alert level can change that value and apply it across current products. Supabase includes a trigger that creates a notification when stock crosses the product’s alert level.

Receipts, code sheets and business-report PDFs include the business name, address/location, phone, email and NileStock attribution. The Help page contains expandable explanations for every navigation page, profile control and top-bar icon.

## Architecture notes

- Monetary values are integers in the browser and PostgreSQL `bigint` (minor currency units), avoiding floating-point drift.
- Core automation is calculation/rule based. AI calls use a server-only OpenAI key and are checked against the authoritative Pro plan before business context is sent; checkout never depends on AI.
- Camera scanning uses browser APIs through `html5-qrcode`; USB/Bluetooth scanners work through the focused keyboard input.
- A business-specific JSON workspace remains the offline snapshot, while receipts also use append-style `nilestock_sales` rows so concurrent phones do not overwrite one another's sales.
- PDF and code generation are client-side using open-source libraries; there is no per-receipt or per-code charge.

## Security before public launch

Test the RLS policies with at least two separate businesses before accepting real sales. Configure storage policies before enabling logo/product-image uploads. NileStock retains an isolated JSON workspace for offline recovery and uses RLS-protected per-sale rows for cross-device receipts; other workspace collections still use the business snapshot.

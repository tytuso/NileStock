# nilestock.shop domain plan

## Recommended structure now

- **nilestock.shop** → the current Vercel NileStock project (marketing + sign-in + POS app)
- **www.nilestock.shop** → redirect to `https://nilestock.shop`

Do **not** create `app.nilestock.shop` yet. The current app already combines the public website and logged-in workspace, so splitting domains would add authentication and SEO complexity without a benefit.

## Possible future subdomains

Only create these when the product actually needs separate deployments:

- `app.nilestock.shop` — authenticated app if the public marketing site becomes separate
- `help.nilestock.shop` — documentation/help centre
- `status.nilestock.shop` — uptime/status page
- `api.nilestock.shop` — only if NileStock later exposes a public API

## Hostinger + Vercel

Add the domain inside Vercel first. Then copy Vercel's exact requested DNS values into Hostinger DNS. This avoids hard-coding an old Vercel IP or CNAME target. Keep the domain registered at Hostinger; DNS can still point the website to Vercel.

## Production environment

Set `NEXT_PUBLIC_SITE_URL=https://nilestock.shop` in Vercel. Keep `.env.example` on localhost for development.

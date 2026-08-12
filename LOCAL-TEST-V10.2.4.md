# NileStock v10.2.4 final pre-deployment test

## Start in VS Code

1. Extract the ZIP into a new folder.
2. Open that folder in VS Code.
3. Keep your existing `.env.local` values private and copy the file into the new folder.
4. Apply `supabase/migrations/20260811143000_nilestock_cross_device_sales.sql` in Nile Core's Supabase SQL Editor.
5. Run `npm install`.
6. Run `npm run dev` for computer testing or `npm run dev:phone` for another device on the same network.

## Same-account phone sync and cashier

- Sign into the same NileStock account/business on phone A and phone B.
- On phone A, complete a sale. Confirm the new receipt initially shows pending only until Supabase confirms it.
- Refresh or refocus phone B. Confirm the receipt appears and the sold product's stock decreases exactly once.
- Repeat with phone A offline. Reconnect it, wait for confirmed sync, then refresh phone B and confirm the receipt appears once.
- At checkout, confirm **Cashier name on receipt** starts with the signed-in user's name. If the account has no display name, it should use the signed-in email instead of “Cashier” or “Shop Owner.”
- Edit the cashier field for one sale and confirm the edited name appears on its on-screen, printed and PDF receipt.
- Sign into a different test business and confirm none of the first business's receipts are visible.

## Light mode and receipt numbers

- Open a new or unconfigured workspace and confirm the app starts in light mode, even when the phone is using a dark system appearance.
- Select Dark in Settings and confirm NileStock respects the deliberate choice. Sign out and confirm the public screen returns to light mode.
- Complete a sale at an exact hour and confirm the receipt follows `NS-YEAR-DDMM-HOURAM/PM`, for example `NS-2026-1008-4PM` for 10 August 2026 at 4:00 PM.
- Complete a sale between hours and confirm the number includes local minutes and seconds, for example `NS-2026-1008-4-07-35PM`.
- Confirm the same number appears in Sales, Receipts, the printed receipt, the PDF and filename, WhatsApp sharing, reports, inventory movements and Audit Log.

## Final iPhone camera test

- Open **Sale**, tap the camera button, and confirm the rear camera gets priority while the keyboard stays closed.
- Choose **Don’t Allow** when Safari asks for camera access. Confirm NileStock shows **Camera permission is blocked** and an **Allow camera** button.
- Tap **Allow camera**. If Safari asks again, choose **Allow** and confirm the scanner starts.
- If Safari does not ask again, use the instructions shown in NileStock: Page Menu → More → Camera → Allow. Alternatively use Settings → Apps → Safari → Camera → Ask or Allow, return to NileStock, then tap **Allow camera** again.
- Tap the manual barcode/QR/SKU field and confirm the keyboard opens only then.
- Submit an empty or unknown manual code and confirm the error appears without forcing the keyboard back open.
- Close and reopen the scanner. NileStock should immediately reuse the approved rear camera.
- Confirm the page never zooms when the scanner or manual field opens.

## Camera failure states

- With another app using the camera, NileStock should say **Camera is busy** and offer **Try camera again**.
- On a device without a camera, manual code entry should remain available.
- Camera scanning must be tested on HTTPS. A plain `http://192.168...` phone URL may be blocked by the browser.

## Regression checks

- Scan a known product. A successful match should play a two-note tone and vibrate.
- Sign out, sign in again, and confirm you remain in NileStock instead of being sent to Zabuni.
- Complete a sale, then use **Share PDF** or **WhatsApp PDF**. On a supported phone, the native share sheet should include the PDF file.
- Open **Receipts** between **Sales** and **Customer Requests**. Free and Starter show the latest 20 receipts, Business 50 and Pro 100.
- Tap each PDF, CSV or image download button. Its label should temporarily change to **Downloaded ✓**.

## OAuth preview note

Google sign-in from Vercel previews requires the Nile Core Supabase redirect allow-list entry `https://*-titus-projects-4a3cc808.vercel.app/**`. See `DEPLOYMENT.md` for the full URL configuration.

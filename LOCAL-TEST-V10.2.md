# NileStock v10.2.0 local test

## Start in VS Code

1. Extract the ZIP into a new folder.
2. Open that folder in VS Code.
3. Keep your existing `.env.local` values private and copy the file into the new folder.
4. Run `npm install`.
5. Run `npm run dev` for computer testing or `npm run dev:phone` for another device on the same network.

## Test this release

- Open **Sale**, tap the camera button, approve the rear camera and scan a product. A successful match should play a two-note tone and vibrate.
- Close and reopen the scanner. NileStock should immediately reuse the remembered camera. The browser still controls whether permission is remembered permanently.
- Confirm the page does not enlarge when the scanner or a form input opens on mobile.
- Complete a sale, then use **Share PDF** or **WhatsApp PDF**. On a supported phone, the native share sheet should include the PDF file. If file sharing is unsupported, NileStock downloads the PDF and opens WhatsApp with attachment instructions.
- Open **Receipts** between **Sales** and **Customer Requests**. Free and Starter show the latest 20 receipts, Business 50 and Pro 100. Older receipt copies leave this page, but sales records remain in Sales and Reports.
- Tap each PDF, CSV or image download button. Its label should temporarily change to **Downloaded ✓**.

## Camera note

Phone browsers require a secure origin for camera access. `localhost` is allowed on the same device, but a plain `http://192.168...` address may block the camera. Use an HTTPS preview when testing the camera from a separate phone.

# NileStock 10.3.5 — receipt printer connections

The receipt Print button now opens connection options instead of immediately
calling the browser print dialog. Existing receipt PDF and sharing buttons remain.

- Android Bluetooth Classic / USB / network: hands ESC/POS bytes to RawBT through
  its documented Android intent. Requires the separate RawBT app, permissions,
  and printer selection in that app. Its terms/pricing are independent.
- Direct Bluetooth LE: common ESC/POS GATT profiles, sequential 20-byte writes,
  plus optional manufacturer service/characteristic UUIDs.
- Direct USB: compatible printer/vendor bulk endpoints in supported browsers;
  respects interface ownership and reports blocked access.
- Desktop Bluetooth Classic / USB serial: browser port selection and configurable
  baud rate, paced writes and port cleanup.
- System printing: installed device printers, including supported Wi-Fi/network,
  USB/Bluetooth drivers and AirPrint. PDF sharing supports manufacturer apps.
- 58/80 mm plain-text thermal output, receipt status, amounts, discounts,
  negotiated markers, customer/cashier and receipt identity.
- Test prints never create sales. Transfer failures do not silently retry;
  status messages distinguish handoff from physically confirmed printing.
- Printer setup guide at `/printing`, linked from receipts and Settings.
- PWA shell/static cache version advanced to 10.3.5.

## Validation

- TypeScript check and optimized Next.js production build.
- 74 unit tests: receipt widths and values, control-character filtering, Android
  intent byte round-trip, BLE chunking, USB endpoint discovery/short writes,
  serial pacing/cleanup, capability detection and cancellation handling.
- Browser checks use simulated device APIs; physical printer validation still
  requires the customer's phone and exact printer model.

## Compatibility limits

Not every printer speaks ESC/POS or exposes a supported BLE/USB/serial endpoint.
iOS browsers do not offer generic direct Bluetooth receipt printing. Use a
compatible AirPrint printer or supported manufacturer app. Browser hardware APIs
need HTTPS and user permission. Direct USB may be unavailable when an OS driver
owns the interface. Classic Bluetooth on Android uses a print app rather than
Web Bluetooth. Receipt printing requires no new server or database migration.

Protocol references:
- https://github.com/402d/rawbt.402d.ru/blob/master/app2/index.php
- https://github.com/402d/DemoRawBtPrinter
- https://developer.chrome.com/docs/capabilities/bluetooth
- https://developer.chrome.com/docs/capabilities/usb
- https://developer.chrome.com/blog/serial-over-bluetooth

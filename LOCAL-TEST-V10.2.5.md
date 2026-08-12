# NileStock v10.2.5 negotiated-price test

1. Add a normal product to the POS cart and complete a sale without touching **Negotiate price**. Confirm the saved product price is used and no `NEG` marker appears.
2. Add a product, tap **Negotiate price**, tap the agreed-price input, and enter a different amount. Confirm the subtotal and total update immediately.
3. Turn **Negotiated price on** off. Confirm the product's original listed price returns.
4. Complete a negotiated sale. Confirm `NEG` appears beside the product on the on-screen receipt, printed receipt and PDF.
5. Open the same business account on another phone. Confirm the negotiated receipt syncs and keeps its agreed price and `NEG` marker.
6. Repeat while offline, then reconnect. Confirm the sale remains pending until Supabase accepts it and is not duplicated.

No new SQL is required for v10.2.5. The v10.2.4 migration in `supabase/migrations/20260811143000_nilestock_cross_device_sales.sql` must already be applied.

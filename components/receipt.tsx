"use client";
import { Sale } from "@/lib/types";
import { useApp } from "@/lib/store";
import { money } from "@/lib/utils";
import { Button } from "./ui";
import { Download, MessageCircle, Printer, Share2 } from "lucide-react";
import { useDownloadFeedback } from "@/lib/use-download-feedback";
import {
  businessInitials,
  createReceiptPdf,
  formatReceiptDate,
} from "@/lib/receipt-pdf";
export function Receipt({ sale, onNew }: { sale: Sale; onNew?: () => void }) {
  const { data } = useApp(),
    b = data.business;
  const { downloadedKey, markDownloaded, labelFor } = useDownloadFeedback();
  const receiptFooter = b.receiptFooter.trim();
  const showNileStockBrand = !/powered by nilestock/i.test(receiptFooter);
  const createPdf = () => createReceiptPdf(b, sale, receiptFooter);
  const filename = `${sale.receiptNo}.pdf`;
  const downloadPdf = () => {
    createPdf().save(filename);
    markDownloaded("receipt");
  };
  const message = `Thank you for shopping with ${b.name}. Your NileStock receipt ${sale.receiptNo} for ${money(sale.total, b.currency)} is ready.`;
  const shareReceiptFile = async () => {
    const receiptPdf = createPdf();
    const file = new File([receiptPdf.output("blob")], filename, {
      type: "application/pdf",
    });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: `Receipt ${sale.receiptNo}`,
          text: message,
          files: [file],
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    receiptPdf.save(filename);
    markDownloaded("receipt");
    const phone = (
      data.customers.find((customer) => customer.id === sale.customerId)
        ?.phone || ""
    ).replace(/\D/g, "");
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(`${message} The PDF has downloaded to this phone. Attach ${filename} in this WhatsApp chat.`)}`,
      "_blank",
    );
  };
  return (
    <div className="receipt-stage mx-auto max-w-xl rounded-[32px] bg-[radial-gradient(circle_at_50%_0%,rgba(82,212,154,.17),transparent_38%)] p-3 sm:p-6">
      <div
        className={`receipt-print receipt-paper-${b.paper} mx-auto max-w-sm overflow-hidden rounded-[28px] border border-emerald-950/10 bg-white text-sm text-black shadow-[0_24px_70px_rgba(18,69,48,.16)]`}
      >
        <div className="receipt-accent h-2 bg-gradient-to-r from-[#07523d] via-[#0d7a53] to-[#3691c9]" />
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-900">
              Sale receipt
            </span>
            <span className="receipt-status inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.11em] text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              {sale.status === "completed"
                ? "Payment complete"
                : sale.status}
            </span>
          </div>

          <div className="text-center">
            <div className="receipt-logo mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#0d7a53] text-sm font-extrabold tracking-wide text-white shadow-[0_8px_24px_rgba(13,122,83,.2)]">
              {businessInitials(b.name)}
            </div>
            <h2 className="mx-auto max-w-[17rem] text-xl font-extrabold leading-tight tracking-[-.02em]">
              {b.name}
            </h2>
            <p className="mt-2 text-[11px] leading-4 text-gray-500">
              {[b.address || b.country, b.phone].filter(Boolean).join(" • ")}
            </p>
          </div>

          <section className="receipt-panel my-5 rounded-2xl border border-[#dfe9e3] bg-[#f7faf8] p-3 text-xs">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[.16em] text-gray-500">
              Receipt details
            </p>
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-4">
                <span className="text-gray-500">Receipt number</span>
                <b className="max-w-[65%] text-right">{sale.receiptNo}</b>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-gray-500">Issued</span>
                <span className="max-w-[65%] text-right font-medium">
                  {formatReceiptDate(sale.createdAt)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-gray-500">Prepared by</span>
                <span className="max-w-[65%] text-right font-medium">
                  {sale.cashier || "Shop owner"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-gray-500">Customer</span>
                <span className="max-w-[65%] text-right font-medium">
                  {sale.customerName || "Walk-in customer"}
                </span>
              </div>
            </div>
          </section>

          <section>
            <div className="receipt-items-head grid grid-cols-[minmax(0,1fr)_minmax(6rem,auto)] items-center rounded-xl bg-[#07523d] px-3 py-2 text-[9px] font-bold uppercase tracking-[.13em] text-white">
              <span>Item</span>
              <span className="text-right">Line total</span>
            </div>
            <div className="divide-y divide-[#e1e9e4]">
              {sale.items.map((i, index) => (
                <div
                  key={`${i.productId}-${index}`}
                  className="receipt-item-row grid grid-cols-[minmax(0,1fr)_minmax(6rem,auto)] items-start px-3 py-3 odd:bg-[#f8faf9]"
                >
                  <span className="min-w-0 pr-2">
                    <span className="flex flex-wrap items-center gap-1 font-semibold leading-4">
                      <span className="break-words">{i.name}</span>
                      {i.negotiated && (
                        <small className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-amber-800">
                          N
                        </small>
                      )}
                    </span>
                    <small className="mt-0.5 block text-[10px] text-gray-500">
                      {i.qty} × {money(i.price, b.currency)} each
                      {!!i.discount &&
                        ` • -${money(i.discount * i.qty, b.currency)}`}
                    </small>
                  </span>
                  <b className="pt-0.5 text-right text-[12px] tabular">
                    {money(i.price * i.qty - i.discount * i.qty, b.currency)}
                  </b>
                </div>
              ))}
            </div>
            {sale.items.some((item) => item.negotiated) && (
              <p className="mt-2 px-1 text-[9px] leading-4 text-gray-500">
                <b className="text-amber-800">N</b> = negotiated price approved
                for this sale
              </p>
            )}
          </section>

          <section className="mt-5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="tabular">{money(sale.subtotal, b.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Discount</span>
              <span className="tabular">-{money(sale.discount, b.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tax</span>
              <span className="tabular">{money(sale.tax, b.currency)}</span>
            </div>
            <div className="receipt-total my-3 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3.5 text-emerald-950">
              <span className="border-l-[3px] border-emerald-600 pl-2 text-base font-extrabold uppercase tracking-wide">
                Total
              </span>
              <span className="text-lg font-extrabold tabular">
                {money(sale.total, b.currency)}
              </span>
            </div>
          </section>

          <section className="receipt-panel rounded-2xl border border-[#dfe9e3] bg-[#f7faf8] p-3 text-xs">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[.16em] text-gray-500">
              Payment
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Method</span>
                <b>{sale.payment}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount received</span>
                <span className="tabular">{money(sale.paid, b.currency)}</span>
              </div>
              <div className="flex justify-between text-emerald-900">
                <span className="font-semibold">Change due</span>
                <b className="tabular">{money(sale.change, b.currency)}</b>
              </div>
            </div>
          </section>

          {sale.note && (
            <div className="mt-3 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-[10px] leading-4 text-gray-600">
              <b>Note:</b> {sale.note}
            </div>
          )}

          <footer className="mt-5 border-t border-[#dfe6e2] pt-4 text-center text-[11px] leading-4 text-gray-500">
            {receiptFooter && (
              <span className="mb-2 block break-words font-bold leading-5 text-black">
                {receiptFooter}
              </span>
            )}
            <span className="block">{b.address || b.country}</span>
            {!![b.phone, b.email].filter(Boolean).length && (
              <span className="mt-0.5 block break-words">
                {[b.phone, b.email].filter(Boolean).join(" • ")}
              </span>
            )}
            {showNileStockBrand && (
              <span className="mt-3 block border-t border-dashed border-[#dfe6e2] pt-3">
                <b className="text-emerald-800">Powered by NileStock</b>
                <small className="mt-0.5 block text-[9px] uppercase tracking-[.14em] text-gray-400">
                  POS &amp; Inventory
                </small>
              </span>
            )}
          </footer>
        </div>
      </div>
      <div className="no-print mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button onClick={() => window.print()}>
          <Printer size={16} /> Print
        </Button>
        <Button variant="secondary" onClick={downloadPdf} aria-live="polite">
          <Download size={16} /> {labelFor("receipt", "PDF")}
        </Button>
        <Button variant="secondary" onClick={shareReceiptFile}>
          <Share2 size={16} /> Share PDF
        </Button>
        <Button
          variant="secondary"
          onClick={shareReceiptFile}
          aria-live="polite"
        >
          <MessageCircle size={16} />{" "}
          {downloadedKey === "receipt" ? "Downloaded ✓" : "WhatsApp PDF"}
        </Button>
      </div>
      {onNew && (
        <Button className="no-print mt-3 w-full" onClick={onNew}>
          New sale
        </Button>
      )}
    </div>
  );
}

"use client";
import { Sale } from "@/lib/types";
import { useApp } from "@/lib/store";
import { money } from "@/lib/utils";
import { Button } from "./ui";
import { Download, MessageCircle, Printer, Share2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { useDownloadFeedback } from "@/lib/use-download-feedback";
export function Receipt({ sale, onNew }: { sale: Sale; onNew?: () => void }) {
  const { data } = useApp(),
    b = data.business;
  const { downloadedKey, markDownloaded, labelFor } = useDownloadFeedback();
  const receiptFooter = b.receiptFooter.trim();
  const showNileStockBrand = !/powered by nilestock/i.test(receiptFooter);
  const createPdf = () => {
    const thermal = b.paper !== "A4";
    const paperWidth = b.paper === "58mm" ? 58 : b.paper === "80mm" ? 80 : 210;
    const paperHeight = thermal
      ? Math.max(150, 116 + sale.items.length * 12)
      : 297;
    const d = new jsPDF({
      unit: "mm",
      format: b.paper === "A4" ? "a4" : [paperWidth, paperHeight],
    });
    const contentWidth = b.paper === "A4" ? 108 : paperWidth - 10;
    const left = b.paper === "A4" ? (paperWidth - contentWidth) / 2 : 5;
    const right = left + contentWidth;
    const centre = paperWidth / 2;
    const line = () => {
      d.setDrawColor(200, 208, 203);
      d.setLineDashPattern([1.2, 1.2], 0);
      d.line(left, y, right, y);
      d.setLineDashPattern([], 0);
    };
    const row = (label: string, value: string, bold = false) => {
      d.setFont("helvetica", bold ? "bold" : "normal");
      d.text(label, left, y);
      d.text(value, right, y, { align: "right" });
      y += bold ? 6.5 : 5;
    };
    if (!thermal) {
      d.setFillColor(244, 249, 246);
      d.rect(0, 0, paperWidth, paperHeight, "F");
      d.setFillColor(255, 255, 255);
      d.setDrawColor(222, 232, 226);
      d.roundedRect(left - 8, 7, contentWidth + 16, 283, 4, 4, "FD");
      d.setFillColor(13, 122, 83);
      d.roundedRect(left - 8, 7, contentWidth + 16, 3, 1.5, 1.5, "F");
    }
    let y = thermal ? 10 : 16;
    d.setFillColor(13, 122, 83);
    d.roundedRect(centre - 6, y, 12, 12, 2.5, 2.5, "F");
    d.setTextColor(255, 255, 255);
    d.setFont("helvetica", "bold");
    d.setFontSize(8);
    d.text("NS", centre, y + 7.8, { align: "center" });
    y += 19;
    d.setTextColor(20, 30, 25);
    d.setFontSize(b.paper === "58mm" ? 11 : 14);
    const businessLines = d.splitTextToSize(b.name, contentWidth - 4);
    d.text(businessLines, centre, y, { align: "center" });
    y += businessLines.length * (b.paper === "58mm" ? 5 : 6) + 2;
    d.setFontSize(8);
    d.setFont("helvetica", "normal");
    d.setTextColor(90, 102, 95);
    const contacts = [b.address || b.country, b.phone]
      .filter(Boolean)
      .join(" • ");
    if (contacts) {
      d.text(d.splitTextToSize(contacts, contentWidth), centre, y, {
        align: "center",
      });
      y += 6;
    }
    line();
    y += 6;
    d.setTextColor(20, 30, 25);
    row("Receipt", sale.receiptNo, true);
    row("Date", new Date(sale.createdAt).toLocaleString());
    row("Cashier", sale.cashier);
    if (sale.customerName) row("Customer", sale.customerName);
    y += 1;
    line();
    y += 7;
    sale.items.forEach((i) => {
      d.setFont("helvetica", "normal");
      d.setFontSize(9);
      d.setTextColor(20, 30, 25);
      d.text(`${i.name}${i.negotiated ? " [NEG]" : ""} × ${i.qty}`, left, y);
      d.setFont("helvetica", "bold");
      d.text(
        money(i.price * i.qty - i.discount * i.qty, b.currency),
        right,
        y,
        { align: "right" },
      );
      y += 4.5;
      d.setFont("helvetica", "normal");
      d.setFontSize(7.5);
      d.setTextColor(105, 115, 109);
      d.text(`${money(i.price, b.currency)} each`, left, y);
      y += 7;
    });
    line();
    y += 6;
    d.setFontSize(8.5);
    d.setTextColor(20, 30, 25);
    row("Subtotal", money(sale.subtotal, b.currency));
    row("Discount", `-${money(sale.discount, b.currency)}`);
    row("Tax", money(sale.tax, b.currency));
    if (!thermal) {
      d.setFillColor(232, 248, 240);
      d.roundedRect(left - 3, y - 4.5, contentWidth + 6, 10, 2, 2, "F");
    }
    d.setTextColor(8, 80, 57);
    d.setFontSize(12);
    row("TOTAL", money(sale.total, b.currency), true);
    d.setTextColor(20, 30, 25);
    d.setFontSize(8.5);
    row(sale.payment, money(sale.paid, b.currency));
    row("Change", money(sale.change, b.currency));
    y += 1;
    line();
    y += 7;
    d.setTextColor(90, 100, 95);
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    const footerContacts = [
      b.address || b.country,
      [b.phone, b.email].filter(Boolean).join(" • "),
    ].filter(Boolean);
    footerContacts.forEach((contact) => {
      d.text(d.splitTextToSize(contact, contentWidth), centre, y, {
        align: "center",
      });
      y += 4.5;
    });
    if (receiptFooter) {
      y += 3;
      d.setTextColor(20, 30, 25);
      d.setFont("helvetica", "bold");
      const footerLines = d.splitTextToSize(receiptFooter, contentWidth);
      d.text(footerLines, centre, y, { align: "center" });
      y += footerLines.length * 4.5;
    }
    if (showNileStockBrand) {
      d.setTextColor(130, 140, 135);
      d.setFont("helvetica", "normal");
      d.text("Powered by NileStock", centre, y, {
        align: "center",
      });
    }
    return d;
  };
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
        className={`receipt-print receipt-paper-${b.paper} mx-auto max-w-sm overflow-hidden rounded-[26px] border border-emerald-950/10 bg-white p-6 text-sm text-black shadow-[0_24px_70px_rgba(18,69,48,.16)]`}
      >
        <div className="text-center">
          <span className="mb-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-emerald-800">
            Payment complete
          </span>
          <div className="receipt-logo mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-[#0d7a53] font-bold text-white">
            NS
          </div>
          <h2 className="text-lg font-bold">{b.name}</h2>
          <p className="mt-1 text-xs text-gray-500">
            {[b.address || b.country, b.phone].filter(Boolean).join(" • ")}
          </p>
        </div>
        <div className="my-4 border-y border-dashed py-3 text-xs">
          <div className="flex justify-between">
            <span>Receipt</span>
            <b>{sale.receiptNo}</b>
          </div>
          <div className="flex justify-between">
            <span>Date</span>
            <span>{new Date(sale.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier</span>
            <span>{sale.cashier}</span>
          </div>
          {sale.customerName && (
            <div className="flex justify-between">
              <span>Customer</span>
              <span>{sale.customerName}</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {sale.items.map((i) => (
            <div key={i.productId} className="flex justify-between">
              <span>
                <span className="inline-flex items-center gap-1">
                  {i.name} × {i.qty}
                  {i.negotiated && (
                    <small className="rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold tracking-wide text-amber-800">
                      NEG
                    </small>
                  )}
                </span>
                <small className="block text-gray-500">
                  {money(i.price, b.currency)} each
                </small>
              </span>
              <b>{money(i.price * i.qty - i.discount * i.qty, b.currency)}</b>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 border-t border-dashed pt-3">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{money(sale.subtotal, b.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{money(sale.discount, b.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{money(sale.tax, b.currency)}</span>
          </div>
          <div className="my-2 flex justify-between rounded-xl bg-emerald-50 px-3 py-3 text-lg font-bold text-emerald-950">
            <span>Total</span>
            <span>{money(sale.total, b.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>{sale.payment}</span>
            <span>{money(sale.paid, b.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Change</span>
            <span>{money(sale.change, b.currency)}</span>
          </div>
        </div>
        <footer className="mt-5 border-t border-dashed pt-4 text-center text-xs text-gray-600">
          <span className="block">{b.address || b.country}</span>
          {!![b.phone, b.email].filter(Boolean).length && (
            <span className="mt-1 block">
              {[b.phone, b.email].filter(Boolean).join(" • ")}
            </span>
          )}
          {receiptFooter && (
            <span className="mt-3 block break-words font-medium leading-5 text-black">
              {receiptFooter}
            </span>
          )}
          {showNileStockBrand && (
            <span className="mt-1 block text-gray-400">
              Securely powered by NileStock
            </span>
          )}
        </footer>
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

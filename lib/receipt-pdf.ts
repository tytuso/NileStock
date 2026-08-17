import { jsPDF } from "jspdf";
import type { Business, Sale } from "./types";
import { money } from "./utils";

const ink = [22, 35, 29] as const;
const muted = [91, 106, 98] as const;
const emerald = [9, 128, 88] as const;
const deepEmerald = [5, 82, 61] as const;
const paleEmerald = [237, 249, 243] as const;
const softPanel = [247, 250, 248] as const;
const lineColor = [218, 228, 222] as const;

function pdfSafeText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replaceAll("•", "|")
    .replaceAll("×", "x")
    .replace(/[–—]/g, "-");
}

export function businessInitials(name: string) {
  const words = name
    .replace(/[“”'"()]/g, " ")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .filter((word) => !["the", "shop", "store", "limited", "ltd"].includes(word.toLowerCase()));
  if (!words.length) return "NS";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function formatReceiptDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${get("day")}/${get("month")}/${get("year")} | ${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

function fitText(
  pdf: jsPDF,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  startSize: number,
  options?: { align?: "left" | "center" | "right"; minSize?: number },
) {
  const safeValue = pdfSafeText(value);
  const minSize = options?.minSize ?? 6;
  let size = startSize;
  pdf.setFontSize(size);
  while (size > minSize && pdf.getTextWidth(safeValue) > maxWidth) {
    size -= 0.5;
    pdf.setFontSize(size);
  }
  let fitted = safeValue;
  while (
    fitted.length > 1 &&
    pdf.getTextWidth(`${fitted}...`) > maxWidth
  ) {
    fitted = fitted.slice(0, -1);
  }
  if (fitted !== safeValue) fitted = `${fitted.trimEnd()}...`;
  pdf.text(fitted, x, y, { align: options?.align ?? "left" });
}

function statusLabel(status: Sale["status"]) {
  if (status === "refunded") return "REFUNDED";
  if (status === "voided") return "VOIDED";
  return "PAYMENT COMPLETE";
}

export function createReceiptPdf(
  business: Business,
  sale: Sale,
  receiptFooter = business.receiptFooter.trim(),
) {
  const thermal = business.paper !== "A4";
  const paperWidth =
    business.paper === "58mm" ? 58 : business.paper === "80mm" ? 80 : 210;
  const contactRows = [
    business.address || business.country,
    [business.phone, business.email].filter(Boolean).join(" | "),
  ].filter(Boolean);
  const negotiatedItems = sale.items.some((item) => item.negotiated);
  const paperHeight = thermal
    ? Math.max(
        175,
        185 +
          sale.items.length * 14 +
          contactRows.length * 4.5 +
          (negotiatedItems ? 7 : 0) +
          (sale.note ? 10 : 0) +
          (receiptFooter ? 8 : 0),
      )
    : 297;
  const pdf = new jsPDF({
    unit: "mm",
    format: business.paper === "A4" ? "a4" : [paperWidth, paperHeight],
    compress: true,
  });
  const contentWidth = business.paper === "A4" ? 108 : paperWidth - 10;
  const left = business.paper === "A4" ? (paperWidth - contentWidth) / 2 : 5;
  const right = left + contentWidth;
  const centre = paperWidth / 2;
  const compact = business.paper === "58mm";
  let y = thermal ? 7 : 13;

  const rule = (position = y) => {
    pdf.setDrawColor(...lineColor);
    pdf.line(left, position, right, position);
  };
  const summaryRow = (
    label: string,
    value: string,
    options?: { bold?: boolean; color?: readonly [number, number, number] },
  ) => {
    pdf.setFont("helvetica", options?.bold ? "bold" : "normal");
    pdf.setTextColor(...(options?.color ?? ink));
    pdf.setFontSize(options?.bold ? 9 : 8);
    fitText(pdf, label, left + 3, y, contentWidth * 0.42, options?.bold ? 9 : 8);
    fitText(pdf, value, right - 3, y, contentWidth * 0.54, options?.bold ? 9 : 8, {
      align: "right",
      minSize: 6,
    });
    y += options?.bold ? 6 : 5;
  };

  if (!thermal) {
    pdf.setFillColor(245, 249, 247);
    pdf.rect(0, 0, paperWidth, paperHeight, "F");
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...lineColor);
    pdf.roundedRect(left - 8, 7, contentWidth + 16, 283, 4, 4, "FD");
  }

  pdf.setFillColor(...deepEmerald);
  pdf.roundedRect(left - (thermal ? 0 : 8), y - (thermal ? 7 : 6), contentWidth + (thermal ? 0 : 16), 3, 1.5, 1.5, "F");
  y += 5;

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...deepEmerald);
  pdf.setFontSize(6.5);
  pdf.text("SALE RECEIPT", left, y + 2);
  const badgeWidth = statusLabel(sale.status) === "PAYMENT COMPLETE" ? 34 : 22;
  pdf.setFillColor(...paleEmerald);
  pdf.roundedRect(right - badgeWidth, y - 2.3, badgeWidth, 6.5, 3.2, 3.2, "F");
  fitText(pdf, statusLabel(sale.status), right - badgeWidth / 2, y + 1.9, badgeWidth - 5, 6.2, {
    align: "center",
    minSize: 5.5,
  });
  y += 9;

  pdf.setFillColor(...emerald);
  pdf.roundedRect(centre - 6, y, 12, 12, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7.5);
  pdf.text(businessInitials(business.name), centre, y + 7.7, {
    align: "center",
  });
  y += 18;

  pdf.setTextColor(...ink);
  pdf.setFontSize(compact ? 11 : 13.5);
  const businessLines = pdf.splitTextToSize(
    pdfSafeText(business.name),
    contentWidth - 6,
  ) as string[];
  pdf.text(businessLines, centre, y, { align: "center" });
  y += businessLines.length * (compact ? 5 : 5.7) + 2;
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...muted);
  pdf.setFontSize(7.3);
  fitText(
    pdf,
    [business.address || business.country, business.phone]
      .filter(Boolean)
      .join(" | "),
    centre,
    y,
    contentWidth - 4,
    7.3,
    { align: "center", minSize: 6 },
  );
  y += 7;

  pdf.setFillColor(...softPanel);
  pdf.setDrawColor(...lineColor);
  const metadataHeight = sale.customerName ? 29 : 24;
  pdf.roundedRect(left, y, contentWidth, metadataHeight, 2.5, 2.5, "FD");
  y += 6;
  pdf.setFontSize(6.2);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...muted);
  pdf.text("RECEIPT DETAILS", left + 3, y);
  y += 5;
  summaryRow("Receipt number", sale.receiptNo, { bold: true });
  summaryRow("Issued", formatReceiptDate(sale.createdAt));
  summaryRow("Prepared by", sale.cashier || "Shop owner");
  if (sale.customerName) summaryRow("Customer", sale.customerName);
  y += 3;

  pdf.setFillColor(...deepEmerald);
  pdf.roundedRect(left, y, contentWidth, 8, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(6.7);
  pdf.text("ITEM", left + 3, y + 5.2);
  pdf.text("LINE TOTAL", right - 3, y + 5.2, { align: "right" });
  y += 8;

  sale.items.forEach((item, index) => {
    const rowTop = y;
    if (index % 2 === 0) {
      pdf.setFillColor(...softPanel);
      pdf.rect(left, rowTop, contentWidth, 14, "F");
    }
    pdf.setTextColor(...ink);
    pdf.setFont("helvetica", "bold");
    const nameWidth = contentWidth * (compact ? 0.52 : 0.6);
    fitText(
      pdf,
      item.name,
      left + 3,
      rowTop + 5.3,
      nameWidth - (item.negotiated ? 7 : 0),
      compact ? 7.5 : 8.2,
      { minSize: 6 },
    );
    if (item.negotiated) {
      const markerX = left + nameWidth - 2.5;
      pdf.setFillColor(255, 245, 214);
      pdf.roundedRect(markerX - 2.5, rowTop + 1.8, 5, 5, 2.5, 2.5, "F");
      pdf.setTextColor(137, 91, 10);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(5.8);
      pdf.text("N", markerX, rowTop + 5.3, { align: "center" });
    }
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...muted);
    fitText(
      pdf,
      `${item.qty} x ${money(item.price, business.currency)} each${item.discount ? ` | -${money(item.discount * item.qty, business.currency)}` : ""}`,
      left + 3,
      rowTop + 10.1,
      nameWidth,
      6.6,
      { minSize: 5.5 },
    );
    pdf.setTextColor(...ink);
    pdf.setFont("helvetica", "bold");
    fitText(
      pdf,
      money(item.price * item.qty - item.discount * item.qty, business.currency),
      right - 3,
      rowTop + 6.8,
      contentWidth * (compact ? 0.4 : 0.36),
      compact ? 7.2 : 8.2,
      { align: "right", minSize: 5.2 },
    );
    pdf.setDrawColor(...lineColor);
    pdf.line(left, rowTop + 14, right, rowTop + 14);
    y += 14;
  });

  if (negotiatedItems) {
    y += 4.5;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...muted);
    pdf.setFontSize(6.5);
    pdf.text("[N] Negotiated price approved for this sale", left + 2, y);
    y += 6;
  } else {
    y += 5;
  }

  summaryRow("Subtotal", money(sale.subtotal, business.currency));
  summaryRow("Discount", `-${money(sale.discount, business.currency)}`);
  summaryRow("Tax", money(sale.tax, business.currency));

  pdf.setFillColor(...paleEmerald);
  pdf.setDrawColor(190, 224, 208);
  pdf.roundedRect(left, y - 4.3, contentWidth, 12, 2.5, 2.5, "FD");
  pdf.setFillColor(...emerald);
  pdf.roundedRect(left + 3, y - 1.8, 2, 7, 1, 1, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...deepEmerald);
  pdf.setFontSize(11.5);
  pdf.text("TOTAL", left + 8, y + 3.3);
  fitText(
    pdf,
    money(sale.total, business.currency),
    right - 3,
    y + 3.3,
    contentWidth * 0.58,
    11.5,
    { align: "right", minSize: 7 },
  );
  y += 14;

  pdf.setFillColor(...softPanel);
  pdf.setDrawColor(...lineColor);
  pdf.roundedRect(left, y, contentWidth, 29, 2.5, 2.5, "FD");
  y += 6;
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...muted);
  pdf.setFontSize(6.2);
  pdf.text("PAYMENT", left + 3, y);
  y += 5;
  summaryRow("Method", sale.payment, { bold: true });
  summaryRow("Amount received", money(sale.paid, business.currency));
  summaryRow("Change due", money(sale.change, business.currency), {
    bold: true,
    color: deepEmerald,
  });
  y += 5;

  if (sale.note) {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...muted);
    pdf.setFontSize(6.6);
    const noteLines = pdf.splitTextToSize(
      `Note: ${pdfSafeText(sale.note)}`,
      contentWidth - 6,
    ) as string[];
    pdf.text(noteLines, left + 3, y);
    y += noteLines.length * 3.5 + 4;
  }

  rule(y);
  y += 7;
  if (receiptFooter) {
    pdf.setTextColor(...ink);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    const footerLines = pdf.splitTextToSize(
      pdfSafeText(receiptFooter),
      contentWidth - 8,
    ) as string[];
    pdf.text(footerLines, centre, y, { align: "center" });
    y += footerLines.length * 4.3 + 2;
  }
  pdf.setTextColor(...muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.7);
  contactRows.forEach((contact) => {
    fitText(pdf, contact, centre, y, contentWidth - 5, 6.7, {
      align: "center",
      minSize: 5.6,
    });
    y += 4;
  });
  if (!/powered by nilestock/i.test(receiptFooter)) {
    y += 2;
    pdf.setTextColor(...deepEmerald);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.4);
    pdf.text("Powered by NileStock", centre, y, { align: "center" });
    y += 3.5;
    pdf.setTextColor(...muted);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.8);
    pdf.text("POS & Inventory", centre, y, { align: "center" });
  }

  return pdf;
}

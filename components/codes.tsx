"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import bwipjs from "bwip-js";
import QRCode from "qrcode";
import { Product } from "@/lib/types";
import { Button, Card, Select } from "./ui";
import { download, fileSafeName, money } from "@/lib/utils";
import { jsPDF } from "jspdf";
import { useApp } from "@/lib/store";
import { hasMinimumPlan } from "@/lib/plans";
import { Lock, Sparkles } from "lucide-react";
import { useDownloadFeedback } from "@/lib/use-download-feedback";
export function ProductCode({
  product,
  qr = false,
}: {
  product: Product;
  qr?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    if (qr)
      QRCode.toCanvas(canvas.current, product.qr || product.barcode, {
        width: 150,
        margin: 2,
      });
    else
      try {
        bwipjs.toCanvas(canvas.current, {
          bcid: "code128",
          text: product.barcode,
          scale: 2,
          height: 12,
          includetext: true,
          textxalign: "center",
        });
      } catch {}
  }, [product, qr]);
  return <canvas ref={canvas} className="mx-auto max-w-full" />;
}

type CodeSort =
  | "az"
  | "za"
  | "newest"
  | "oldest"
  | "price-low"
  | "price-high";

function sortCodeProducts(products: Product[], sort: CodeSort) {
  return [...products].sort((a, b) => {
    if (sort === "az")
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });

    if (sort === "za")
      return b.name.localeCompare(a.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });

    if (sort === "newest")
      return (
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
      );

    if (sort === "oldest")
      return (
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
      );

    if (sort === "price-low") return a.price - b.price;

    if (sort === "price-high") return b.price - a.price;

    return 0;
  });
}

function codeSortName(sort: CodeSort) {
  if (sort === "az") return "A–Z";
  if (sort === "za") return "Z–A";
  if (sort === "newest") return "Newest first";
  if (sort === "oldest") return "Oldest first";
  if (sort === "price-low") return "Price low to high";
  return "Price high to low";
}
export function CodeCatalogue({
  products,
  openBilling,
}: {
  products: Product[];
  openBilling: () => void;
}) {
  const { data } = useApp();
  const { downloadedKey, markDownloaded, labelFor } = useDownloadFeedback();
  const canExport = hasMinimumPlan(data.business.plan, "starter");
  const [selected, setSelected] = useState<string[]>(products.map((p) => p.id));
  const [mode, setMode] = useState<"barcode" | "qr">("barcode");
  const [perPage, setPerPage] = useState(16);
  const [sortBy, setSortBy] = useState<CodeSort>("az");

const orderedProducts = useMemo(
  () => sortCodeProducts(products, sortBy),
  [products, sortBy],
);
    const createPdf = async (save = true) => {
    if (!canExport) {
      openBilling();
      return;
    }

    const chosen = sortCodeProducts(
      products.filter((p) => selected.includes(p.id)),
      sortBy,
    );

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const cols =
      perPage === 4 ? 2 : perPage === 9 ? 3 : perPage === 16 ? 4 : 5;

    const rows = Math.ceil(perPage / cols);
    const gap = perPage <= 9 ? 4 : 2.6;

    const left = 10;
    const top = 54;
    const usableW = 190;
    const usableH = 222;

    const cellW = (usableW - gap * (cols - 1)) / cols;
    const cellH = (usableH - gap * (rows - 1)) / rows;

    const deepEmerald = [6, 75, 58] as const;
    const emerald = [8, 124, 85] as const;
    const blue = [55, 126, 184] as const;
    const ink = [24, 43, 36] as const;
    const muted = [91, 108, 100] as const;

    const businessLocation =
      data.business.address || data.business.country || "";

    const businessContact = [
      businessLocation,
      data.business.phone,
      data.business.email,
    ]
      .filter(Boolean)
      .join("  |  ");

    const drawHeader = () => {
      // Main premium header
      pdf.setFillColor(...deepEmerald);
      pdf.rect(0, 0, 210, 31, "F");

      pdf.setFillColor(...emerald);
      pdf.rect(154, 0, 56, 31, "F");

      pdf.setFillColor(...blue);
      pdf.rect(0, 31, 210, 2.5, "F");

      // NileStock logo block
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(14, 8, 12, 12, 2.5, 2.5, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...deepEmerald);
      pdf.setFontSize(8);
      pdf.text("NS", 20, 15.6, { align: "center" });

      // Brand
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14.5);
      pdf.text("NileStock", 30, 13.5);

      // Business name
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");

      const businessName =
        pdf.splitTextToSize(data.business.name, 100)[0] ||
        data.business.name;

      pdf.text(businessName, 30, 20.5);

      // Contact / location
      pdf.setTextColor(226, 244, 237);
      pdf.setFontSize(6.8);

      const contactLines = pdf
        .splitTextToSize(businessContact || "nilestock.shop", 48)
        .slice(0, 2);

      pdf.text(contactLines, 196, 12.5, {
        align: "right",
      });

      // Sheet title
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...ink);
      pdf.setFontSize(16);
      pdf.text("Product Code Sheet", 14, 43);

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...muted);
      pdf.setFontSize(7.3);

      pdf.text(
        "Cut along the dashed borders • Scan before attaching labels",
        14,
        48.5,
      );

      pdf.text(
        `Order: ${codeSortName(sortBy)} • Generated ${new Date().toLocaleDateString()}`,
        196,
        48.5,
        { align: "right" },
      );
    };

    drawHeader();

    for (let i = 0; i < chosen.length; i++) {
      if (i && i % perPage === 0) {
        pdf.addPage();
        drawHeader();
      }

      const p = chosen[i];
      const index = i % perPage;
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = left + col * (cellW + gap);
      const y = top + row * (cellH + gap);

      const cardW = cellW;
      const cardH = cellH;

      // Card background
      pdf.setFillColor(251, 253, 252);
      pdf.roundedRect(x, y, cardW, cardH, 2, 2, "F");

      // Cutting border
      pdf.setDrawColor(155, 171, 162);
      pdf.setLineWidth(0.25);
      pdf.setLineDashPattern([1.4, 1.2], 0);
      pdf.roundedRect(x, y, cardW, cardH, 2, 2, "S");
      pdf.setLineDashPattern([], 0);

      // NileStock mark
      pdf.setFillColor(...emerald);
      pdf.roundedRect(x + 3, y + 3, 7, 6, 1.3, 1.3, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.text("N", x + 6.5, y + 7.2, {
        align: "center",
      });

      // Product name
      pdf.setTextColor(...ink);
      pdf.setFont("helvetica", "bold");

      pdf.setFontSize(
        perPage <= 9 ? 10 : perPage === 16 ? 8 : 7,
      );

      const productLine =
        pdf.splitTextToSize(
          p.name,
          Math.max(14, cardW - 16),
        )[0] || p.name;

      pdf.text(productLine, x + 12, y + 6.8);

      // SKU
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(perPage <= 9 ? 8 : 6.5);
      pdf.setTextColor(80, 95, 87);
      pdf.text(p.sku, x + 3, y + 13);

      // Price
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...emerald);

      pdf.text(
        money(p.price),
        x + cardW - 3,
        y + 13,
        { align: "right" },
      );

      const canvas = document.createElement("canvas");

      if (mode === "qr") {
        await QRCode.toCanvas(
          canvas,
          p.qr || p.barcode,
          {
            width: 300,
            margin: 1,
          },
        );
      } else {
        bwipjs.toCanvas(canvas, {
          bcid: "code128",
          text: p.barcode,
          scale: 4,
          height: 16,
          includetext: true,
          textxalign: "center",
        });
      }

      const availableH = Math.max(14, cardH - 23);
      const qrSize = Math.min(cardW - 10, availableH);

      const barcodeH = Math.min(
        perPage <= 9
          ? 28
          : perPage === 16
            ? 21
            : 16,
        availableH,
      );

      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        mode === "qr"
          ? x + (cardW - qrSize) / 2
          : x + 4,
        y + 16,
        mode === "qr"
          ? qrSize
          : cardW - 8,
        mode === "qr"
          ? qrSize
          : barcodeH,
      );

      // Bottom separator
      pdf.setDrawColor(223, 231, 226);
      pdf.setLineWidth(0.2);

      pdf.line(
        x + 3,
        y + cardH - 5,
        x + cardW - 3,
        y + cardH - 5,
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(5.5);
      pdf.setTextColor(112, 126, 118);

      pdf.text(
        "nilestock.shop",
        x + 3,
        y + cardH - 2.2,
      );

      pdf.text(
        mode === "qr"
          ? "QR label"
          : "Barcode label",
        x + cardW - 3,
        y + cardH - 2.2,
        { align: "right" },
      );
    }

    // Premium footer on every PDF page
    const pages = pdf.getNumberOfPages();

    for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
      pdf.setPage(pageNumber);

      pdf.setDrawColor(214, 225, 219);
      pdf.line(14, 283, 196, 283);

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...muted);
      pdf.setFontSize(6.8);

      const footerLeft = [
        data.business.name,
        data.business.phone,
      ]
        .filter(Boolean)
        .join("  |  ");

      pdf.text(
        footerLeft,
        14,
        290,
      );

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...deepEmerald);

      pdf.text(
        "Powered by nilestock.shop",
        105,
        290,
        { align: "center" },
      );

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...muted);

      pdf.text(
        `Page ${pageNumber} of ${pages}`,
        196,
        290,
        { align: "right" },
      );
    }

    if (save) {
      pdf.save(
        `${fileSafeName(data.business.name)}-product-codes.pdf`,
      );

      markDownloaded("catalogue");
    }

    return pdf;
  };
  const shareWhatsApp = async () => {
    if (!canExport) {
      openBilling();
      return;
    }
    const pdf = await createPdf(false);
    if (!pdf) return;
    const filename = `${fileSafeName(data.business.name)}-product-codes.pdf`;
    const file = new File([pdf.output("blob")], filename, {
      type: "application/pdf",
    });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: `${data.business.name} product codes`,
          text: `${data.business.name} barcode and QR catalogue`,
          files: [file],
        });
        return;
      } catch {}
    }
    pdf.save(filename);
    markDownloaded("catalogue");
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${data.business.name} product code catalogue is ready. Download the PDF first, then attach it in WhatsApp.`)}`,
      "_blank",
    );
  };
  return (
    <div>
      {!canExport && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-emerald-50 p-4 text-sm dark:border-amber-900/60 dark:from-amber-950/35 dark:to-emerald-950/35">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-amber-700 shadow-sm dark:bg-white/10 dark:text-amber-300">
            <Lock size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <b className="flex items-center gap-2">
              Code downloads are a Lite feature
              <span className="text-[10px] font-bold text-red-600">STARTER</span>
            </b>
            <p className="mt-1 text-xs text-muted">
              You can preview every barcode and QR code. Upgrade to download,
              print or share them.
            </p>
          </div>
          <Button onClick={openBilling}>
            <Sparkles size={15} /> Upgrade to Lite
          </Button>
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            setSelected(
              selected.length === products.length
                ? []
                : products.map((p) => p.id),
            )
          }
        >
          {selected.length === products.length ? "Unselect all" : "Select all"}
        </Button>
        <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold">
          Codes per A4 page
          <Select
          
            className="h-9 w-40 border-0"
            value={perPage}
            onChange={(e) => setPerPage(+e.target.value)}
          >
            <option value="4">4 — Extra large</option>
            <option value="9">9 — Large</option>
            <option value="16">16 — Standard</option>
            <option value="25">25 — Small</option>
          </Select>

        </label>
        <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold">
  Label order
  <Select
    className="h-9 w-40 border-0"
    value={sortBy}
    onChange={(e) =>
      setSortBy(e.target.value as CodeSort)
    }
  >
    <option value="az">A → Z</option>
    <option value="za">Z → A</option>
    <option value="newest">Newest first</option>
    <option value="oldest">Oldest first</option>
    <option value="price-low">Price: low → high</option>
    <option value="price-high">Price: high → low</option>
  </Select>
</label>
        <Button
          variant={mode === "barcode" ? "primary" : "secondary"}
          onClick={() => setMode("barcode")}
        >
          Barcodes
        </Button>
        <Button
          variant={mode === "qr" ? "primary" : "secondary"}
          onClick={() => setMode("qr")}
        >
          QR codes
        </Button>
        <Button
          onClick={() => (canExport ? void createPdf() : openBilling())}
          disabled={!selected.length}
          aria-live="polite"
        >
          {!canExport && <Lock size={14} />}
          {canExport
            ? labelFor("catalogue", "Download selected PDF")
            : "Lite • Download PDF"}
        </Button>
        <Button
          variant="secondary"
          onClick={shareWhatsApp}
          disabled={!selected.length}
        >
          {!canExport && <Lock size={14} />}
          {canExport ? "Share to WhatsApp" : "Lite • Share codes"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => (canExport ? window.print() : openBilling())}
        >
          {!canExport && <Lock size={14} />}
          {canExport ? "Print labels" : "Lite • Print labels"}
        </Button>
      </div>
      <div
        className="code-print grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-per-page={perPage}
      >
        <div className="print-only col-span-full border-b pb-3 text-center">
          <b className="text-lg">{data.business.name} • Product Codes</b>
          <p className="text-xs">
            {data.business.address || data.business.country} •{" "}
            {[data.business.phone, data.business.email]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>
        {orderedProducts.map((p) => (
          <Card
            key={p.id}
            className="code-label overflow-hidden p-0"
            data-selected={selected.includes(p.id) ? "true" : "false"}
          >
            <div className="code-label-top flex items-start gap-3 bg-emerald-950 px-3 py-2.5 text-white">
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm">{p.name}</b>
                <span className="mt-0.5 block text-[10px] text-white/65">{p.sku}</span>
              </div>
              <label className="no-print mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10">
                <input
                  aria-label={`Select ${p.name}`}
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() =>
                    setSelected((s) =>
                      s.includes(p.id)
                        ? s.filter((x) => x !== p.id)
                        : [...s, p.id],
                    )
                  }
                />
              </label>
            </div>

            <div className="code-label-body bg-white p-3 text-black">
              <ProductCode product={p} qr={mode === "qr"} />
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-black/10 pt-2 text-xs">
                <span className="font-mono text-[10px] text-black/60">{p.sku}</span>
                <b className="text-emerald-800">{money(p.price)}</b>
              </div>
              <p className="mt-1 text-center text-[9px] uppercase tracking-[.16em] text-black/35">
                nilestock.shop
              </p>
            </div>

            <Button
              variant="ghost"
              className="no-print m-2 mt-0 w-[calc(100%-1rem)]"
              onClick={() => {
                if (!canExport) {
                  openBilling();
                  return;
                }
                const c = document.querySelectorAll("canvas")[
                  orderedProducts.indexOf(p)
                ] as HTMLCanvasElement;
                if (c)
                  c.toBlob((blob) => {
                    if (!blob) return;
                    download(`${p.sku}.png`, blob, "image/png");
                    markDownloaded(p.id);
                  });
              }}
              aria-live="polite"
            >
              {!canExport && <Lock size={14} />}
              {canExport
                ? downloadedKey === p.id
                  ? "Downloaded ✓"
                  : "Download image"
                : "Upgrade to download"}
            </Button>
          </Card>
        ))}
        <div className="print-only col-span-full border-t pt-3 text-center text-xs">
          {data.business.address || data.business.country} •{" "}
          {[data.business.phone, data.business.email]
            .filter(Boolean)
            .join(" • ")}
          <br />
          Powered by NileStock
        </div>
      </div>
    </div>
  );
}

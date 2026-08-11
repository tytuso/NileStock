"use client";
import { useEffect, useRef, useState } from "react";
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
  const createPdf = async (save = true) => {
    if (!canExport) {
      openBilling();
      return;
    }
    const chosen = products.filter((p) => selected.includes(p.id));
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const cols = Math.round(Math.sqrt(perPage)),
      rows = Math.ceil(perPage / cols),
      cellW = 190 / cols,
      cellH = 242 / rows;
    const decorate = () => {
      pdf.setFillColor(8, 124, 85);
      pdf.rect(0, 0, 210, 20, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(13);
      pdf.text(`${data.business.name} • Product Codes`, 10, 12);
      pdf.setFontSize(7);
      pdf.setTextColor(90, 105, 97);
      pdf.text(
        `${data.business.address || data.business.country} • ${data.business.phone || data.business.email || "Powered by NileStock"}`,
        105,
        291,
        { align: "center" },
      );
    };
    decorate();
    for (let i = 0; i < chosen.length; i++) {
      if (i && i % perPage === 0) {
        pdf.addPage();
        decorate();
      }
      const p = chosen[i],
        index = i % perPage,
        col = index % cols,
        row = Math.floor(index / cols),
        x = 10 + col * cellW,
        y = 25 + row * cellH;
      pdf.setTextColor(20, 37, 30);
      pdf.setFontSize(perPage <= 9 ? 11 : 8);
      pdf.text(p.name, x, y);
      pdf.setFontSize(perPage <= 9 ? 9 : 7);
      pdf.text(`${money(p.price)}  •  ${p.sku}`, x, y + 5);
      const c = document.createElement("canvas");
      if (mode === "qr")
        await QRCode.toCanvas(c, p.qr || p.barcode, { width: 260, margin: 2 });
      else
        bwipjs.toCanvas(c, {
          bcid: "code128",
          text: p.barcode,
          scale: 3,
          height: 16,
          includetext: true,
        });
      pdf.addImage(
        c.toDataURL("image/png"),
        "PNG",
        x + 2,
        y + 8,
        mode === "qr" ? Math.min(cellW - 8, cellH - 20) : cellW - 8,
        mode === "qr"
          ? Math.min(cellW - 8, cellH - 20)
          : Math.min(25, cellH - 20),
      );
    }
    if (save) {
      pdf.save(`${fileSafeName(data.business.name)}-product-codes.pdf`);
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
              Code downloads are a Starter feature
              <span className="text-[10px] font-bold text-red-600">STARTER</span>
            </b>
            <p className="mt-1 text-xs text-muted">
              You can preview every barcode and QR code. Upgrade to download,
              print or share them.
            </p>
          </div>
          <Button onClick={openBilling}>
            <Sparkles size={15} /> Upgrade to Starter
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
            : "Starter • Download PDF"}
        </Button>
        <Button
          variant="secondary"
          onClick={shareWhatsApp}
          disabled={!selected.length}
        >
          {!canExport && <Lock size={14} />}
          {canExport ? "Share to WhatsApp" : "Starter • Share codes"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => (canExport ? window.print() : openBilling())}
        >
          {!canExport && <Lock size={14} />}
          {canExport ? "Print labels" : "Starter • Print labels"}
        </Button>
      </div>
      <div className="code-print grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="print-only col-span-full border-b pb-3 text-center">
          <b className="text-lg">{data.business.name} • Product Codes</b>
          <p className="text-xs">
            {data.business.address || data.business.country} •{" "}
            {[data.business.phone, data.business.email]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>
        {products.map((p) => (
          <Card key={p.id} className="p-4">
            <label className="mb-2 flex gap-2 text-sm font-semibold">
              <input
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
              {p.name}
            </label>
            <div className="rounded-lg bg-white p-3 text-black">
              <ProductCode product={p} qr={mode === "qr"} />
              <p className="mt-2 text-center text-xs">
                {p.sku} • {money(p.price)}
              </p>
            </div>
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => {
                if (!canExport) {
                  openBilling();
                  return;
                }
                const c = document.querySelectorAll("canvas")[
                  products.indexOf(p)
                ] as HTMLCanvasElement;
                if (c)
                  c.toBlob(
                    (blob) => {
                      if (!blob) return;
                      download(`${p.sku}.png`, blob, "image/png");
                      markDownloaded(p.id);
                    },
                  );
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

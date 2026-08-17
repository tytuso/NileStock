import { jsPDF } from "jspdf";
import type { Business } from "./types";
import type { ReportSnapshot } from "./reports";

const PAGE_WIDTH = 210;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_LINE_Y = 282;
const FOOTER_TEXT_Y = 289;
const TABLE_ROW_HEIGHT = 12;

const ink = [24, 43, 36] as const;
const muted = [91, 108, 100] as const;
const emerald = [8, 124, 85] as const;
const deepEmerald = [6, 75, 58] as const;
const blue = [55, 126, 184] as const;

function cleanText(value: string) {
  return value.replaceAll(" • ", "  |  ");
}

function truncateToWidth(
  pdf: jsPDF,
  value: string,
  maxWidth: number,
  size: number,
) {
  pdf.setFontSize(size);
  if (pdf.getTextWidth(value) <= maxWidth) return value;
  let result = value;
  while (result.length > 1 && pdf.getTextWidth(`${result}...`) > maxWidth)
    result = result.slice(0, -1);
  return `${result.trimEnd()}...`;
}

function fittedText(
  pdf: jsPDF,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  startSize: number,
  options?: { align?: "left" | "center" | "right"; minSize?: number },
) {
  const minSize = options?.minSize ?? 7;
  let size = startSize;
  pdf.setFontSize(size);
  while (size > minSize && pdf.getTextWidth(value) > maxWidth) {
    size -= 0.5;
    pdf.setFontSize(size);
  }
  const text = truncateToWidth(pdf, value, maxWidth, size);
  pdf.text(text, x, y, { align: options?.align ?? "left" });
}

function drawHeader(
  pdf: jsPDF,
  business: Business,
  snapshot: ReportSnapshot,
  generatedAt: Date,
  continued = false,
) {
  pdf.setFillColor(...deepEmerald);
  pdf.rect(0, 0, PAGE_WIDTH, 31, "F");
  pdf.setFillColor(...emerald);
  pdf.rect(158, 0, 52, 31, "F");
  pdf.setFillColor(...blue);
  pdf.rect(0, 31, PAGE_WIDTH, 2.5, "F");

  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(14, 8, 12, 12, 2.5, 2.5, "F");
  pdf.setTextColor(...deepEmerald);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("NS", 20, 15.6, { align: "center" });

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14.5);
  pdf.text("NileStock", 30, 13.5);
  pdf.setFont("helvetica", "normal");
  fittedText(pdf, business.name, 30, 20, 92, 8.5, { minSize: 7 });

  const contact = cleanText(
    [business.address || business.country, business.phone, business.email]
      .filter(Boolean)
      .join("  |  "),
  );
  pdf.setTextColor(226, 244, 237);
  fittedText(pdf, contact, 196, 18, 67, 7.5, {
    align: "right",
    minSize: 6,
  });

  pdf.setTextColor(...ink);
  pdf.setFont("helvetica", "bold");
  fittedText(
    pdf,
    `${snapshot.title}${continued ? " - continued" : ""}`,
    16,
    45,
    112,
    17,
    { minSize: 12 },
  );

  pdf.setFont("helvetica", "normal");
  pdf.setFillColor(232, 247, 240);
  const period = cleanText(snapshot.period);
  pdf.setFontSize(7.5);
  const periodWidth = Math.min(74, Math.max(30, pdf.getTextWidth(period) + 8));
  pdf.roundedRect(16, 49, periodWidth, 7, 3.5, 3.5, "F");
  pdf.setTextColor(...deepEmerald);
  fittedText(pdf, period, 20, 53.8, periodWidth - 8, 7.5, { minSize: 6.5 });

  pdf.setTextColor(...muted);
  fittedText(
    pdf,
    `Generated ${generatedAt.toLocaleString()}`,
    194,
    53.5,
    75,
    7.5,
    { align: "right", minSize: 6.5 },
  );
}

function drawMetrics(pdf: jsPDF, snapshot: ReportSnapshot) {
  const gap = 3;
  const width = (CONTENT_WIDTH - gap * 3) / 4;
  const cardColors = [
    [238, 249, 244],
    [239, 247, 252],
    [245, 246, 250],
    [250, 247, 238],
  ] as const;
  snapshot.metrics.slice(0, 4).forEach((metric, index) => {
    const x = MARGIN + index * (width + gap);
    const accent = index === 1 ? blue : emerald;
    const cardColor = cardColors[index] ?? cardColors[0];
    pdf.setFillColor(cardColor[0], cardColor[1], cardColor[2]);
    pdf.setDrawColor(221, 231, 226);
    pdf.roundedRect(x, 62, width, 24, 2.5, 2.5, "FD");
    pdf.setFillColor(accent[0], accent[1], accent[2]);
    pdf.roundedRect(x + 4, 67, 2, 13, 1, 1, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...muted);
    fittedText(pdf, metric.label, x + 9, 70.5, width - 13, 7.5, {
      minSize: 6.5,
    });
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...ink);
    fittedText(pdf, metric.value, x + 9, 79.3, width - 13, 11, {
      minSize: 7.5,
    });
  });
}

function drawInsight(pdf: jsPDF, snapshot: ReportSnapshot) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  const lines = pdf.splitTextToSize(cleanText(snapshot.insight), 164) as string[];
  const height = Math.max(16, 9 + lines.length * 4.5);
  pdf.setFillColor(246, 250, 248);
  pdf.setDrawColor(222, 232, 226);
  pdf.roundedRect(MARGIN, 92, CONTENT_WIDTH, height, 2.5, 2.5, "FD");
  pdf.setFillColor(...emerald);
  pdf.roundedRect(18, 97, 2, Math.max(6, height - 10), 1, 1, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...deepEmerald);
  pdf.setFontSize(7.2);
  pdf.text("REPORT SUMMARY", 24, 99.5);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...ink);
  pdf.setFontSize(8.5);
  pdf.text(lines, 24, 105);
  return 92 + height;
}

function drawTableHeader(pdf: jsPDF, y: number) {
  pdf.setFillColor(...deepEmerald);
  pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, 9, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7.5);
  pdf.text("#", 18, y + 5.8);
  pdf.text("RECORD", 28, y + 5.8);
  pdf.text("DETAILS", 100, y + 5.8);
  pdf.text("VALUE", 191, y + 5.8, { align: "right" });
  return y + 9;
}

function drawTableRow(
  pdf: jsPDF,
  row: ReportSnapshot["rows"][number],
  index: number,
  y: number,
) {
  if (index % 2 === 0) {
    pdf.setFillColor(248, 251, 249);
    pdf.rect(MARGIN, y, CONTENT_WIDTH, TABLE_ROW_HEIGHT, "F");
  }
  pdf.setDrawColor(226, 233, 229);
  pdf.line(MARGIN, y + TABLE_ROW_HEIGHT, MARGIN + CONTENT_WIDTH, y + TABLE_ROW_HEIGHT);
  pdf.line(25, y, 25, y + TABLE_ROW_HEIGHT);
  pdf.line(96, y, 96, y + TABLE_ROW_HEIGHT);
  pdf.line(158, y, 158, y + TABLE_ROW_HEIGHT);

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...muted);
  pdf.setFontSize(7.5);
  pdf.text(String(index + 1), 19.5, y + 7.2, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...ink);
  fittedText(pdf, cleanText(row.label), 29, y + 7.2, 63, 8.5, {
    minSize: 6.5,
  });
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...muted);
  fittedText(pdf, cleanText(row.detail), 100, y + 7.2, 54, 7.2, {
    minSize: 6,
  });

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...deepEmerald);
  fittedText(pdf, cleanText(row.value), 191, y + 7.2, 29, 8.5, {
    align: "right",
    minSize: 6,
  });
}

function drawEmptyState(pdf: jsPDF, y: number) {
  pdf.setFillColor(248, 251, 249);
  pdf.setDrawColor(222, 232, 226);
  pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, 28, 3, 3, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...ink);
  pdf.setFontSize(10);
  pdf.text("No records available", PAGE_WIDTH / 2, y + 11, {
    align: "center",
  });
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...muted);
  pdf.setFontSize(8);
  pdf.text(
    "New activity will appear in this report automatically.",
    PAGE_WIDTH / 2,
    y + 18,
    { align: "center" },
  );
}

function drawFooters(pdf: jsPDF, business: Business) {
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(214, 225, 219);
    pdf.line(MARGIN, FOOTER_LINE_Y, PAGE_WIDTH - MARGIN, FOOTER_LINE_Y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...muted);
    fittedText(
      pdf,
      cleanText([business.name, business.phone].filter(Boolean).join("  |  ")),
      MARGIN,
      FOOTER_TEXT_Y,
      70,
      7,
      { minSize: 6 },
    );
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...deepEmerald);
    pdf.setFontSize(7);
    pdf.text("Powered by NileStock", PAGE_WIDTH / 2, FOOTER_TEXT_Y, {
      align: "center",
    });
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...muted);
    pdf.text(`Page ${page} of ${pages}`, PAGE_WIDTH - MARGIN, FOOTER_TEXT_Y, {
      align: "right",
    });
  }
}

export function createBrandedReportPdf(
  business: Business,
  snapshot: ReportSnapshot,
  generatedAt = new Date(),
) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  drawHeader(pdf, business, snapshot, generatedAt);
  drawMetrics(pdf, snapshot);
  const insightBottom = drawInsight(pdf, snapshot);
  let y = drawTableHeader(pdf, insightBottom + 7);

  if (!snapshot.rows.length) drawEmptyState(pdf, y + 3);

  snapshot.rows.forEach((row, index) => {
    if (y + TABLE_ROW_HEIGHT > FOOTER_LINE_Y - 3) {
      pdf.addPage();
      drawHeader(pdf, business, snapshot, generatedAt, true);
      y = drawTableHeader(pdf, 63);
    }
    drawTableRow(pdf, row, index, y);
    y += TABLE_ROW_HEIGHT;
  });

  drawFooters(pdf, business);
  return pdf;
}

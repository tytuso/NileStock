import type { AppData } from "./types";

export type InsightPeriod = "today" | "last7Days" | "last30Days" | "thisMonth" | "lastMonth" | "allTime" | "custom";
export type InsightRange = { from: string; to: string };
export type InsightQuery = { period?: InsightPeriod; from?: string; to?: string };
type ProductSort = "unitsSold" | "revenue" | "grossProfit" | "stockRisk" | "slowMoving";
const DAY = 86_400_000;
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const text = (value: unknown, max = 120) => String(value || "").trim().slice(0, max);
const rows = <T>(value: T[] | undefined): T[] => Array.isArray(value) ? value.filter((x) => x && typeof x === "object") : [];
const sum = <T>(values: T[], amount: (value: T) => number) => values.reduce((total, value) => total + amount(value), 0);
const rounded = (value: number, precision = 2) => Math.round((value + Number.EPSILON) * 10 ** precision) / 10 ** precision;

export function insightTimeZone(value?: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: value || "Africa/Kampala" }); return value || "Africa/Kampala"; }
  catch { return "Africa/Kampala"; }
}

export function insightDate(value: string | Date, timeZone: string) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

export function createBusinessInsights(data: AppData, options: { now?: Date; timeZone?: string } = {}) {
  const now = options.now || new Date();
  const timeZone = insightTimeZone(options.timeZone);
  const today = insightDate(now, timeZone);
  const currency = /^[A-Z]{3}$/.test(data.business.currency || "") ? data.business.currency : "UGX";
  let precision = 2;
  try { precision = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2; } catch { /* Unknown currencies use two decimals. */ }
  const money = (value: number) => rounded(value, precision);
  const products = rows(data.products);
  const sales = rows(data.sales);
  const datedSales = sales.map((sale) => ({ sale, date: insightDate(sale.createdAt, timeZone) })).filter((s) => s.date);
  const completed = datedSales.filter(({ sale }) => sale.status === "completed");
  const firstSaleDate = completed.map((s) => s.date).sort()[0] || null;
  const latestSaleDate = completed.map((s) => s.date).sort().at(-1) || null;
  const monthStart = `${today.slice(0, 7)}-01`;
  const previousMonthEnd = shiftDate(monthStart, -1);
  const previousMonthStart = `${previousMonthEnd.slice(0, 7)}-01`;
  const matchedPreviousEnd = `${previousMonthEnd.slice(0, 7)}-${String(Math.min(Number(today.slice(-2)), Number(previousMonthEnd.slice(-2)))).padStart(2, "0")}`;

  function range(query: InsightQuery = {}): InsightRange {
    const period = query.period || "last30Days";
    if (period === "today") return { from: today, to: today };
    if (period === "last7Days") return { from: shiftDate(today, -6), to: today };
    if (period === "last30Days") return { from: shiftDate(today, -29), to: today };
    if (period === "thisMonth") return { from: monthStart, to: today };
    if (period === "lastMonth") return { from: previousMonthStart, to: previousMonthEnd };
    if (period === "allTime") return { from: "", to: today };
    const from = query.from ? insightDate(query.from, timeZone) : "";
    const to = query.to ? insightDate(query.to, timeZone) : "";
    if (!from || !to || from > to) throw new RangeError("Provide valid From and To dates in YYYY-MM-DD order.");
    if (to > today) throw new RangeError("Recorded performance cannot include future dates. Use the pricing scenario for estimates.");
    return { from, to };
  }
  const within = (date: string, selected: InsightRange) => !!date && (!selected.from || date >= selected.from) && date <= selected.to;

  function report(query: InsightQuery = {}) {
    const selected = range(query);
    const all = datedSales.filter(({ date }) => within(date, selected));
    const included = all.filter(({ sale }) => sale.status === "completed");
    const expenses = rows(data.expenses).filter((e) => within(insightDate(e.date, timeZone), selected));
    const ledgerPayments = rows(data.customerEntries).filter((e) => e.kind === "payment" && within(insightDate(e.date, timeZone), selected));
    const purchases = rows(data.purchases).filter((p) => within(insightDate(p.date, timeZone), selected));
    const byProduct = new Map<string, { id: string; name: string; units: number; netSales: number; costOfGoods: number; zeroCostUnits: number; lastSold: string }>();
    const byDate = new Map<string, { period: string; sales: number; transactions: number }>();
    const expenseCategories = new Map<string, number>();
    let recordedSales = 0, salesTax = 0, costOfGoods = 0, units = 0, upfrontReceived = 0, zeroCostUnits = 0, unallocatedSales = 0;
    for (const { sale, date } of included) {
      const total = Math.max(0, finite(sale.total));
      const tax = Math.min(total, Math.max(0, finite(sale.tax)));
      const net = total - tax;
      recordedSales += total; salesTax += tax;
      upfrontReceived += sale.payment === "Customer Credit"
        ? Math.min(total, Math.max(0, finite(sale.creditPaid)))
        : Math.min(total, Math.max(0, finite(sale.paid) - finite(sale.change)));
      const items = rows(sale.items).filter((item) => finite(item.qty) > 0);
      const weights = items.map((item) => Math.max(0, finite(item.price) - finite(item.discount)) * finite(item.qty));
      const weightTotal = sum(weights, (weight) => weight);
      let remainder = Math.round(net * 10 ** precision);
      items.forEach((item, index) => {
        const productId = text(item.productId) || `unlinked:${text(item.name)}`;
        const record = byProduct.get(productId) || { id: productId, name: text(item.name) || "Unnamed product", units: 0, netSales: 0, costOfGoods: 0, zeroCostUnits: 0, lastSold: date };
        const qty = finite(item.qty), cost = Math.max(0, finite(item.cost)) * qty;
        const allocated = weightTotal > 0 ? index === items.length - 1 ? remainder : Math.min(remainder, Math.round(net * 10 ** precision * weights[index] / weightTotal)) : 0;
        remainder -= allocated;
        record.units += qty; record.netSales += allocated / 10 ** precision; record.costOfGoods += cost;
        if (!(finite(item.cost) > 0)) { record.zeroCostUnits += qty; zeroCostUnits += qty; }
        if (date > record.lastSold) record.lastSold = date;
        byProduct.set(productId, record);
        costOfGoods += cost; units += qty;
      });
      unallocatedSales += remainder / 10 ** precision;
      const dateKey = selected.from && Date.parse(selected.to) - Date.parse(selected.from) < 62 * DAY ? date : date.slice(0, 7);
      const bucket = byDate.get(dateKey) || { period: dateKey, sales: 0, transactions: 0 };
      bucket.sales += total; bucket.transactions++;
      byDate.set(dateKey, bucket);
    }
    for (const expense of expenses) {
      const key = text(expense.category) || "Uncategorised";
      expenseCategories.set(key, (expenseCategories.get(key) || 0) + finite(expense.amount));
    }
    const expenseTotal = sum(expenses, (e) => finite(e.amount));
    const netSales = recordedSales - salesTax;
    const grossProfit = netSales - costOfGoods;
    const allProducts = [...byProduct.values()].map((p) => ({ ...p, units: rounded(p.units, 3), netSales: money(p.netSales), costOfGoods: money(p.costOfGoods), grossProfit: money(p.netSales - p.costOfGoods), grossMarginPercent: p.netSales > 0 ? rounded((p.netSales - p.costOfGoods) / p.netSales * 100) : null }));
    const warnings: string[] = [];
    if (!included.length) warnings.push("No completed sales are recorded for this period; this does not establish that the business had no activity.");
    if (zeroCostUnits) warnings.push(`${rounded(zeroCostUnits, 3)} sold units have zero or missing recorded costs. Verify these costs before relying on profit estimates.`);
    if (unallocatedSales) warnings.push("Some sale totals could not be allocated to product lines; product totals may not cover the entire sales total.");
    if (firstSaleDate && selected.from && firstSaleDate > selected.from) warnings.push(`Recorded sales history starts on ${firstSaleDate}, after this period begins. Comparisons may be incomplete.`);
    return {
      range: selected, currency, timeZone,
      totals: { completedSales: included.length, refundedSalesExcluded: all.filter(({ sale }) => sale.status === "refunded").length,
        voidedSalesExcluded: all.filter(({ sale }) => sale.status === "voided").length,
        recordedSalesIncludingTax: money(recordedSales), recordedSalesTax: money(salesTax), netSalesExcludingTax: money(netSales),
        recordedCostOfGoods: money(costOfGoods), estimatedGrossProfit: money(grossProfit), recordedOperatingExpenses: money(expenseTotal),
        estimatedOperatingProfit: money(grossProfit - expenseTotal), grossMarginPercent: netSales > 0 ? rounded(grossProfit / netSales * 100) : null,
        unitsSold: rounded(units, 3), averageSaleIncludingTax: included.length ? money(recordedSales / included.length) : 0,
        upfrontPaymentsReceived: money(upfrontReceived), customerRepaymentsRecorded: money(sum(ledgerPayments, (e) => finite(e.amount))),
        supplierPaymentsRecorded: money(sum(purchases, (p) => finite(p.paid))) },
      topProducts: [...allProducts].sort((a, b) => b.units - a.units).slice(0, 5),
      expenseCategories: [...expenseCategories].map(([category, amount]) => ({ category, amount: money(amount) })).sort((a, b) => b.amount - a.amount).slice(0, 12),
      salesTrend: [...byDate.values()].sort((a, b) => a.period.localeCompare(b.period)).slice(-36).map((r) => ({ ...r, sales: money(r.sales) })),
      trendGranularity: selected.from && Date.parse(selected.to) - Date.parse(selected.from) < 62 * DAY ? "day" : "month",
      trendPeriodsTotal: byDate.size, trendPeriodsReturned: Math.min(36, byDate.size), warnings,
      productsSold: allProducts.length, productMetrics: allProducts,
    };
  }

  function productInsights(query: InsightQuery & { query?: string; productId?: string; sortBy?: ProductSort; offset?: number; limit?: number } = {}) {
    const result = report(query);
    const metrics = new Map(result.productMetrics.map((p) => [p.id, p]));
    const catalog = new Map(products.map((p) => [p.id, p]));
    const ids = new Set([...catalog.keys(), ...metrics.keys()]);
    const days = Math.max(1, (Date.parse(result.range.to) - Date.parse(result.range.from || firstSaleDate || today)) / DAY + 1);
    const term = (query.query || "").trim().toLowerCase();
    const matched = [...ids].flatMap((id) => {
      const product = catalog.get(id), metric = metrics.get(id);
      const name = text(product?.name || metric?.name) || "Unnamed product";
      if (query.productId && id !== query.productId) return [];
      if (term && ![name, product?.sku, product?.category, id].some((v) => text(v).toLowerCase().includes(term))) return [];
      const unitsSold = metric?.units || 0;
      const stock = product ? Math.max(0, finite(product.stock)) : null;
      const cost = product ? Math.max(0, finite(product.cost)) : null;
      const price = product ? Math.max(0, finite(product.price)) : null;
      const active = !!product && product.active !== false;
      return [{ id, name, sku: text(product?.sku), category: text(product?.category), active, inCurrentCatalog: !!product,
        stock, unit: text(product?.unit) || "unit", reorderLevel: product ? finite(product.reorder) : null,
        currentPriceExcludingAddedTax: price, currentUnitCost: cost,
        currentUnitGrossProfit: price !== null && cost !== null ? money(price - cost) : null,
        currentGrossMarginPercent: price && cost !== null ? rounded((price - cost) / price * 100) : null,
        verifyUnitCost: cost === null || cost <= 0,
        unitsSold, netSales: metric?.netSales || 0, estimatedGrossProfit: metric?.grossProfit || 0,
        estimatedDaysOfStock: stock !== null && unitsSold > 0 ? rounded(stock / (unitsSold / days), 1) : null,
        lowStock: active && stock !== null && stock <= finite(product?.reorder),
        lastSoldInPeriod: metric?.lastSold || null }];
    });
    const sort = query.sortBy || "unitsSold";
    matched.sort((a, b) => sort === "stockRisk" ? Number(b.lowStock) - Number(a.lowStock) || (a.estimatedDaysOfStock ?? Infinity) - (b.estimatedDaysOfStock ?? Infinity) || b.unitsSold - a.unitsSold
      : sort === "slowMoving" ? Number(b.active) - Number(a.active) || a.unitsSold - b.unitsSold || (b.stock || 0) - (a.stock || 0)
      : sort === "grossProfit" ? b.estimatedGrossProfit - a.estimatedGrossProfit
      : sort === "revenue" ? b.netSales - a.netSales : b.unitsSold - a.unitsSold);
    const offset = Math.max(0, Math.floor(query.offset || 0));
    const limit = Math.max(1, Math.min(20, Math.floor(query.limit || 10)));
    return { range: result.range, currency, sortedBy: sort, totalMatches: matched.length, offset, nextOffset: offset + limit < matched.length ? offset + limit : null,
      products: matched.slice(offset, offset + limit), warnings: result.warnings,
      interpretation: "Stock is the current saved balance; sales are for the selected dates. Stock-cover estimates assume the same selling pace and are not demand forecasts. Zero sales in this period does not prove a product has never sold." };
  }

  function demand(query = "", offset = 0, limit = 10) {
    const grouped = new Map<string, { product: string; quantity: number; requests: number }>();
    for (const request of rows(data.requests)) {
      const product = text(request.product);
      if (request.status !== "open" || !product.toLowerCase().includes(query.trim().toLowerCase())) continue;
      const key = product.toLowerCase(), row = grouped.get(key) || { product, quantity: 0, requests: 0 };
      row.quantity += Math.max(0, finite(request.quantity)); row.requests++;
      grouped.set(key, row);
    }
    const sorted = [...grouped.values()].sort((a, b) => b.quantity - a.quantity);
    return { totalMatches: sorted.length, requests: sorted.slice(offset, offset + Math.min(20, limit)), nextOffset: offset + limit < sorted.length ? offset + limit : null,
      interpretation: "These are open recorded requests, not confirmed orders or guaranteed future demand." };
  }

  function priceScenario(productId: string, proposedPrice: number, assumedUnits: number) {
    const product = products.find((p) => p.id === productId);
    if (!product) return { error: "Find the product in the catalog first and use its exact ID." };
    if (!Number.isFinite(proposedPrice) || proposedPrice < 0 || !Number.isFinite(assumedUnits) || assumedUnits <= 0) return { error: "Provide a non-negative price and a positive assumed quantity." };
    const price = Math.max(0, finite(product.price)), cost = Math.max(0, finite(product.cost));
    if (!Number.isSafeInteger(Math.round(Math.max(price, cost, proposedPrice) * assumedUnits * 10 ** precision)))
      return { error: "This scenario is too large for accurate money calculations. Use a smaller price or quantity." };
    const oldContribution = price - cost, proposedContribution = proposedPrice - cost;
    return { product: text(product.name), currency, currentPrice: price, recordedUnitCost: cost, proposedPrice, assumedUnits,
      currentUnitGrossProfit: money(oldContribution), proposedUnitGrossProfit: money(proposedContribution),
      proposedGrossMarginPercent: proposedPrice > 0 ? rounded(proposedContribution / proposedPrice * 100) : null,
      currentGrossProfitAtAssumedUnits: money(oldContribution * assumedUnits), proposedGrossProfitAtAssumedUnits: money(proposedContribution * assumedUnits),
      unitsNeededToMatchCurrentGrossProfit: proposedContribution > 0 && oldContribution > 0 ? Math.ceil(oldContribution * assumedUnits / proposedContribution) : null,
      verifyUnitCost: !(cost > 0), active: product.active !== false,
      assumptions: "A scenario, not a forecast. Uses current recorded unit cost, excludes added sales tax and operating expenses, and assumes the proposed number of units sells. It does not change any price or stock." };
  }

  function summary() {
    const compact = (query: InsightQuery) => {
      const r = report(query);
      return { range: r.range, totals: r.totals, topProducts: r.topProducts.slice(0, 3), expenseCategories: r.expenseCategories.slice(0, 5), warnings: r.warnings };
    };
    const month = compact({ period: "thisMonth" });
    const previous = compact({ period: "custom", from: previousMonthStart, to: matchedPreviousEnd });
    return {
      asOf: now.toISOString(), today, timeZone, currency,
      business: { name: text(data.business.name), country: text(data.business.country), ownerBrief: text(data.business.adviserNotes, 1500) },
      coverage: { catalogProducts: products.length, recordedSaleRecords: sales.length, firstCompletedSale: firstSaleDate, latestCompletedSale: latestSaleDate,
        invalidSaleDatesExcluded: sales.length - datedSales.length, contactDetailsExcluded: true },
      todayPerformance: compact({ period: "today" }), last7Days: compact({ period: "last7Days" }), monthToDate: month,
      previousMonthComparableDays: previous,
      monthComparison: { recordedSalesDifference: money(month.totals.recordedSalesIncludingTax - previous.totals.recordedSalesIncludingTax),
        recordedSalesChangePercent: previous.totals.recordedSalesIncludingTax > 0 ? rounded((month.totals.recordedSalesIncludingTax / previous.totals.recordedSalesIncludingTax - 1) * 100) : null,
        estimatedOperatingProfitDifference: money(month.totals.estimatedOperatingProfit - previous.totals.estimatedOperatingProfit),
        note: "Month-to-date compared with matching calendar days of the previous month, capped at that month's last day. Verify coverage warnings before claiming growth." },
      currentInventory: { activeProducts: products.filter((p) => p.active !== false).length,
        lowStockProducts: products.filter((p) => p.active !== false && finite(p.stock) <= finite(p.reorder)).length,
        outOfStockProducts: products.filter((p) => p.active !== false && finite(p.stock) <= 0).length,
        recordedStockCostValue: money(sum(products, (p) => Math.max(0, finite(p.stock)) * Math.max(0, finite(p.cost)))),
        activeProductsWithZeroOrMissingCost: products.filter((p) => p.active !== false && !(finite(p.cost) > 0)).length },
      credit: { customerCreditOutstanding: money(sum(rows(data.customers), (c) => Math.max(0, finite(c.balance)))),
        customersWithOutstandingBalances: rows(data.customers).filter((c) => finite(c.balance) > 0).length,
        supplierBalanceOutstanding: money(sum(rows(data.suppliers), (s) => Math.max(0, finite(s.balance)))) },
      stockPriorities: productInsights({ period: "last30Days", sortBy: "stockRisk", limit: 5 }).products,
      customerDemand: demand("", 0, 5),
      definitions: "Recorded sales including tax match sale receipt totals. Net sales exclude recorded sales tax. Estimated gross profit = net sales minus historical item costs. Estimated operating profit also subtracts recorded operating expenses; unrecorded costs, wages, interest and other taxes may be missing. Stock purchases are not counted again as operating expenses. Upfront receipts exclude change and unpaid credit. These figures are not a bank balance. Refunded/voided sales are excluded using original sale dates; a separate refund-date cashflow is unavailable. Only saved records are known; no market data or automatic business actions are available.",
      lookupCoverage: "All catalog and historical product IDs can be searched with tools. Summary highlights and tool pages are ranked subsets; use filters and nextOffset for more. No arbitrary first-30-products limit.",
    };
  }
  function compare(current: InsightQuery, previous: InsightQuery) {
    const { productMetrics: _currentProducts, ...a } = report(current);
    const { productMetrics: _previousProducts, ...b } = report(previous);
    const fields = ["recordedSalesIncludingTax", "netSalesExcludingTax", "recordedCostOfGoods", "recordedOperatingExpenses", "estimatedOperatingProfit", "completedSales", "unitsSold", "averageSaleIncludingTax"] as const;
    return { current: a, previous: b, changes: Object.fromEntries(fields.map((key) => [key, {
      difference: rounded(a.totals[key] - b.totals[key], precision),
      percentChange: b.totals[key] > 0 ? rounded((a.totals[key] / b.totals[key] - 1) * 100) : null,
    }])), note: "A missing or non-positive comparison baseline has no meaningful percentage change. Differences identify recorded changes, not proof of their causes; check data coverage." };
  }
  return { summary, report, compare, productInsights, demand, priceScenario, range };
}

export type BusinessInsights = ReturnType<typeof createBusinessInsights>;

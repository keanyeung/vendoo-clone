import type { Sale, SalesRange } from "./analytics";
import { PLATFORM_SHORT_LABELS } from "./sales-format";

const SOLD_ITEMS_HEADER = [
  "Item",
  "Sold date",
  "Platform",
  "Sold price",
  "Paid",
  "Fees",
  "Profit",
  "ROI",
] as const;

function quoteCsvField(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function utcDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function buildSoldItemsCsv(sales: Sale[]): string {
  const rows = sales.map((sale) => [
    sale.title,
    utcDate(sale.soldAt),
    sale.platform === null ? "" : PLATFORM_SHORT_LABELS[sale.platform],
    sale.soldPrice,
    sale.purchasePrice,
    sale.fees,
    sale.profit,
    sale.roiPct ?? "",
  ]);

  return [SOLD_ITEMS_HEADER, ...rows]
    .map((row) => row.map(quoteCsvField).join(","))
    .join("\r\n");
}

export function soldItemsCsvFilename(range: SalesRange, now: Date): string {
  return `sold-items-${range}-${now.toISOString().slice(0, 10)}.csv`;
}

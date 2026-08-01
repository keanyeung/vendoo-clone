import type { ProfitBucket } from "./analytics";
import { formatMoney } from "./sales-format";

export type ProfitBarTone = "latest" | "positive" | "negative" | "empty";

export type ProfitBar = {
  key: string;
  label: string;
  tip: string;
  valueLabel: string;
  heightPct: number;
  tone: ProfitBarTone;
};

export function toProfitBars(buckets: ProfitBucket[]): ProfitBar[] {
  const maxAbs = Math.max(
    1,
    ...buckets.map((bucket: ProfitBucket) => Math.abs(bucket.profit)),
  );
  const latestActiveIndex = buckets.reduce(
    (latest: number, bucket: ProfitBucket, index: number) =>
      bucket.count > 0 ? index : latest,
    -1,
  );

  return buckets.map((bucket: ProfitBucket, index: number) => {
    const isActive = bucket.count > 0;
    const height = isActive
      ? Math.max(3, (Math.abs(bucket.profit) / maxAbs) * 100)
      : 0;
    let tone: ProfitBarTone;

    if (!isActive) {
      tone = "empty";
    } else if (bucket.profit < 0) {
      tone = "negative";
    } else if (index === latestActiveIndex) {
      tone = "latest";
    } else {
      tone = "positive";
    }

    return {
      key: bucket.key,
      label: bucket.label,
      tip: `${bucket.tipLabel} · ${formatMoney(bucket.profit)} from ${bucket.count} ${bucket.count === 1 ? "sale" : "sales"}`,
      valueLabel: isActive ? formatMoney(bucket.profit) : "",
      heightPct: Math.round(height * 10) / 10,
      tone,
    };
  });
}

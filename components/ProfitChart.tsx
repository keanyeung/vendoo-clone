import type { MonthlyBucket } from "@/lib/analytics";

export type ProfitChartProps = {
  monthly: MonthlyBucket[];
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Intentionally server-rendered: this static chart needs no client JavaScript.
export default function ProfitChart({
  monthly,
}: ProfitChartProps) {
  if (monthly.length === 0) {
    return null;
  }

  const maxAbs = Math.max(
    ...monthly.map((bucket: MonthlyBucket) => Math.abs(bucket.profit)),
  );
  const hasNegative = monthly.some(
    (bucket: MonthlyBucket) => bucket.profit < 0,
  );

  return (
    <section className="mt-8 rounded-xl border border-black/15 p-5 dark:border-white/20">
      <h2 className="text-lg font-semibold">Profit by month</h2>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Monthly profit for the selected range.
      </p>

      <div className="mt-6 overflow-x-auto">
        <div
          aria-hidden="true"
          className="flex min-w-full items-end gap-2 pb-2"
        >
          {monthly.map((bucket: MonthlyBucket) => {
            // Preserve zero months without dividing by zero when the series is flat.
            const height =
              maxAbs === 0
                ? "2px"
                : `${Math.max((Math.abs(bucket.profit) / maxAbs) * 100, 3)}%`;
            const value = currencyFormatter.format(bucket.profit);

            return (
              <div
                key={bucket.key}
                className="min-w-12 flex-1 text-center"
              >
                <div className="flex h-40 flex-col">
                  <div
                    className={`flex flex-col justify-end ${
                      hasNegative ? "h-1/2" : "h-full"
                    }`}
                  >
                    {bucket.profit >= 0 && (
                      <>
                        <span className="mb-1 text-[10px] leading-none text-black/60 dark:text-white/60">
                          {value}
                        </span>
                        <div
                          className="mx-auto w-7 rounded-t-sm bg-green-600/70 dark:bg-green-400/70"
                          style={{ height }}
                        />
                      </>
                    )}
                  </div>

                  {hasNegative && (
                    <div className="flex h-1/2 flex-col border-t border-black/30 dark:border-white/30">
                      {bucket.profit < 0 && (
                        <>
                          <div
                            className="mx-auto w-7 rounded-b-sm bg-red-600/70 dark:bg-red-400/70"
                            style={{ height }}
                          />
                          <span className="mt-1 text-[10px] leading-none text-black/60 dark:text-white/60">
                            {value}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs whitespace-nowrap text-black/60 dark:text-white/60">
                  {bucket.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <details className="mt-5 border-t border-black/10 pt-4 dark:border-white/15">
        <summary className="cursor-pointer text-sm font-medium">
          View as table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-md text-left text-sm">
            <thead className="border-b border-black/15 text-black/60 dark:border-white/20 dark:text-white/60">
              <tr>
                <th className="px-2 py-2 font-medium">Month</th>
                <th className="px-2 py-2 text-right font-medium">Items</th>
                <th className="px-2 py-2 text-right font-medium">Revenue</th>
                <th className="px-2 py-2 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((bucket: MonthlyBucket) => (
                <tr
                  key={bucket.key}
                  className="border-b border-black/10 last:border-b-0 dark:border-white/15"
                >
                  <th className="px-2 py-2 font-normal">{bucket.label}</th>
                  <td className="px-2 py-2 text-right">
                    {bucket.itemsSold}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {currencyFormatter.format(bucket.revenue)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {currencyFormatter.format(bucket.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

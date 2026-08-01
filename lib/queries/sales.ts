import "server-only";

import { rangeBounds, previousBounds, type SalesRange } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { toItemDtos } from "@/lib/item-dto";
import { buildSalesView, type SalesView } from "@/lib/sales-view";

export async function loadSalesView(
  range: SalesRange,
  now: Date,
): Promise<SalesView> {
  // This lookup is intentionally separate: earliest-ever and the combined current/comparison window are different questions.
  const earliestResult = await prisma.item.aggregate({
    where: { status: "SOLD", soldDate: { not: null } },
    _min: { soldDate: true },
  });
  const earliest = earliestResult._min.soldDate;
  const bounds = rangeBounds(range, now, earliest);
  const previous = previousBounds(bounds);

  // One read covers both windows. Full rows preserve toItemDtos/toSales as the normalization path; revisit if this table grows materially.
  const rows = await prisma.item.findMany({
    where: {
      status: "SOLD",
      soldDate: { gte: previous.start, lt: bounds.end },
    },
    orderBy: { soldDate: "desc" },
  });

  return buildSalesView(toItemDtos(rows), range, now, earliest);
}

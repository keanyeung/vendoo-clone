# Home redesign — implementation brief

**Goal:** replace the near-empty `/` page with a dashboard homepage that previews the subpages (listings, analytics) and surfaces items needing action, behind a persistent app shell.

**Visual reference:** `design/home.html` (self-contained; open it in a browser and read its source). It is the source of truth for layout, spacing, and color. This document is the source of truth for implementation. Where they disagree, ask before choosing.

**Stack (do not change):** Next.js App Router, React server components by default, Tailwind v4 (`@import "tailwindcss"` in `app/globals.css`), Prisma, Zod. No new dependencies. No CSS-in-JS, no component library.

---

## 0. Ground rules for agents

- Read every file listed in a task before editing it. Do not infer file contents.
- Keep the existing dark-mode strategy: `@media (prefers-color-scheme: dark)` with `--background` / `--foreground` in `app/globals.css`. Every new surface must be legible in **both** schemes — write Tailwind pairs the way the existing code does (`border-black/15 dark:border-white/20`, `text-black/60 dark:text-white/60`).
- Reference HTML is dark-mode only. Translate its literal colors to the existing Tailwind token pairs, do not hardcode `#0a0a0a`.
- Server components unless interactivity is required. The whole homepage can be a server component — nothing on it needs client JS except the existing `logout` form action.
- Every new aggregate must be a pure function in `lib/`, unit-testable, taking `ItemDto[]` and returning a plain object. No Prisma calls inside components.
- Do not modify `prisma/schema.prisma`. All metrics below are derivable from existing fields.
- Preserve accessibility conventions already in the codebase: `min-h-11` on tap targets, `aria-*` on toggles, `role="alert"` on errors, `<caption className="sr-only">` on tables.

---

## 1. Data model available (already exists — read, don't guess)

- `prisma/schema.prisma` — `Item` model.
- `lib/item-dto.ts` — `ItemDto`, `toItemDto`, `toItemDtos`.
- `lib/analytics.ts` — `computeAnalytics(items, range, now)`, `computeProfit(item)`, `computeRoi(item)`, `ANALYTICS_RANGES`, `RANGE_LABELS`, `isAnalyticsRange`, types `AnalyticsRange`, `AnalyticsSummary`, `MonthlyBucket`.
- `lib/listing-sort.ts` — `daysListed(item, now)`, `parseSort`, `sortItems`, `serializeSort`.
- `lib/status-style.ts` — `STATUS_STYLES` (DRAFT / LISTED / SOLD badge label + className).

`ItemDto` fields used below: `status`, `listPrice`, `purchasePrice`, `soldPrice`, `soldDate`, `soldPlatform`, `platformFees`, `createdAt`, `photos`, `title`, `brand`, `size`, `category`.

---

## Task 1 — App shell (`components/AppHeader.tsx` + `app/layout.tsx`)

**Files:** create `components/AppHeader.tsx`; edit `app/layout.tsx`, `app/page.tsx`, `app/listings/page.tsx`, `app/listings/[id]/page.tsx`, `app/analytics/page.tsx`, `app/new/page.tsx`.

Create a server component `AppHeader` rendering a sticky top bar:

- Height 60px, bottom border (`border-black/10 dark:border-white/12`), `sticky top-0 z-10`, translucent background with `backdrop-blur`.
- Inner container `mx-auto max-w-[1120px] px-6`, flex, space-between.
- Left: wordmark "Vendoo Clone" (15px, `font-semibold`, `tracking-tight`) linking to `/`; then nav links Home `/`, Listings `/listings`, Analytics `/analytics` — 14px, `rounded-md px-2.5 py-1.5`, active link gets a subtle filled background (`bg-black/[.06] dark:bg-white/[.09]`) and `font-medium`, inactive is muted.
- Right: primary "New listing" link to `/new` (`bg-foreground text-background rounded-md px-3.5 py-2.5 text-sm font-semibold`, leading `+`), then the existing `logout` server action form as a bordered button.

**Active state:** the header must know the current route. Either make `AppHeader` a client component using `usePathname()`, or keep it a server component and pass an `active` prop from each page. Prefer the client component — it is one small component and keeps pages simpler.

Mount `<AppHeader />` in `app/layout.tsx` above `{children}` inside `<body>`. **Exclude it from `/login`** — `app/login/layout.tsx` already exists; keep login's own layout free of the header (verify by reading `app/login/layout.tsx` before wiring).

Then **remove the now-duplicated navigation** from each page:
- `app/page.tsx` — the whole button row.
- `app/listings/page.tsx` — the "← Back to home" link, and the "New Listing" / "Analytics" buttons in the header row.
- `app/listings/[id]/page.tsx` — the "← Back to listings" link stays (it is a hierarchy link, not nav), but restyle it consistently.
- `app/analytics/page.tsx`, `app/new/page.tsx` — the "← Back to home" links.

Also widen the page containers to `max-w-[1120px]` on `/` so the dashboard grid matches the reference. Leave `/listings`, `/analytics`, `/new` widths as they are for now.

**Acceptance:** header appears on every route except `/login`; the active nav item is highlighted; no page renders its own duplicate nav; light and dark both legible.

---

## Task 2 — Dashboard aggregates (`lib/dashboard.ts`)

**Files:** create `lib/dashboard.ts`. Read `lib/analytics.ts` and `lib/listing-sort.ts` first and reuse their helpers — do not reimplement profit math.

Export one pure function:

```ts
export type DashboardSummary = {
  revenueThisMonth: number;
  profitThisMonth: number;
  salesThisMonth: number;
  revenueYtd: number;
  marginThisMonthPct: number | null;
  activeListings: number;
  draftCount: number;
  soldCount: number;
  inventoryValue: number;        // sum of listPrice for LISTED items
  avgDaysToSell: number | null;  // mean(soldDate - createdAt) over SOLD items with a soldDate
  avgDaysToSellPrevMonth: number | null;
  sellThroughPct: number | null; // soldCount / (soldCount + activeListings)
  topCategory: string | null;    // category with the highest total profit
  bestMonth: MonthlyBucket | null;
  avgProfitPerItem: number | null;
  recent: ItemDto[];             // 5 most recently updated, any status
  attention: AttentionItem[];
};

export type AttentionItem = {
  kind: "stale_draft" | "aging_listing" | "missing_fees";
  title: string;   // e.g. "3 drafts never published"
  detail: string;  // e.g. "Oldest added 12 days ago"
  action: string;  // button label: "Review" | "Price" | "Fix"
  href: string;    // deep link into /listings with filters applied
  count: number;
};

export function computeDashboard(items: ItemDto[], now: Date): DashboardSummary;
```

Rules:
- "This month" = calendar month of `now` in **local** time (match `localDate()` in `components/ItemSellSection.tsx` — do not shift to UTC).
- Profit per item is `computeProfit` from `lib/analytics.ts`. Never recompute inline.
- `avgDaysToSell` uses `soldDate - createdAt` in whole days, SOLD items only, skipping null `soldDate`.
- Attention rules (each only emitted when `count > 0`):
  - `stale_draft` — DRAFT items older than 7 days. `href: /listings?status=DRAFT`.
  - `aging_listing` — LISTED items with `daysListed(item, now) > 45`. `href: /listings?status=LISTED&sort=added-asc` (verify the sort token against `serializeSort` in `lib/listing-sort.ts`).
  - `missing_fees` — SOLD items with `platformFees === null`. `href: /listings?status=SOLD`.
- Sort `attention` by `count` descending; cap at 3 entries.
- Return zeros/nulls cleanly for an empty inventory — the function must not throw or divide by zero.

**Acceptance:** pure, no Prisma import, no `Date.now()` inside (takes `now`), handles empty input.

---

## Task 3 — Homepage (`app/page.tsx` + section components)

**Files:** rewrite `app/page.tsx`; create `components/DashboardMetrics.tsx`, `components/DashboardListings.tsx`, `components/DashboardAnalytics.tsx`, `components/DashboardAttention.tsx`. All server components.

`app/page.tsx` becomes an async server component:

```ts
export const dynamic = "force-dynamic"; // matches listings/analytics pages
const items = await prisma.item.findMany();
const summary = computeDashboard(toItemDtos(items), new Date());
```

Layout, matching `design/home.html`:

1. **Greeting row** — `h1` 28px `font-semibold tracking-tight` ("Good morning/afternoon/evening" by local hour); muted subline summarising `attention` (e.g. "3 drafts waiting and 2 listings going stale"); right-aligned muted date (`weekday, short month, day`).
2. **Metrics grid** — `grid grid-cols-4 gap-3` (`grid-cols-2` under `sm`, `grid-cols-1` under 480px). Each card: `rounded-xl border p-4`, uppercase 11px tracked label, 26px `font-semibold` value, 12px muted sub-line.
   - Revenue this month → sub: "{salesThisMonth} sales · {revenueYtd} YTD"
   - Profit this month → green when ≥ 0, red when < 0 (use the same `text-green-700 dark:text-green-400` / `text-red-700 dark:text-red-400` pair as `app/analytics/page.tsx`) → sub: margin %
   - Active listings → sub: inventory value
   - Avg days to sell → sub: delta vs. previous month, or "not enough sales yet"
3. **Two-column body** — `grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-3`, collapsing to one column under `lg`.
   - **Left: Listings preview.** Card header ("Listings" + "{n} active · {n} drafts · {n} sold all time") with a "View all →" link to `/listings`. Below it a chip row of status counts, each chip linking to `/listings?status=…`. Then the 5 `recent` items as rows: 48px rounded photo thumb (`item.photos[0]`, striped placeholder when absent), title (truncate), muted meta line (`category · size · N days listed`, or `sold {date} on {platform}` for SOLD), status badge from `STATUS_STYLES`, right-aligned price. Whole row links to `/listings/{id}`.
   - **Right column, stacked:**
     - **Analytics preview.** Header + "Open →" to `/analytics`. A 6-bar monthly profit chart, last 6 buckets from `computeAnalytics(...).monthly`, current month highlighted. Then a 2×2 definition list: best month, avg profit/item, top category, sell-through. **Server-rendered, no client JS** — follow the existing `components/ProfitChart.tsx` approach (percentage heights via inline `style`, `aria-hidden` on the bars).
     - **Needs attention.** Header + "{n} items to deal with"; one row per `AttentionItem` with title, detail, and an action link to `item.href`.

**Empty state:** when there are zero items, replace the whole two-column body with a single centered card — heading "Add your first item", one line of copy, and a primary "New listing" button. Keep the metrics grid hidden in that case rather than showing four zeros.

**Acceptance:** `/` renders from real DB data; every block deep-links correctly; no client-side JS added beyond the logout form; verify against `design/home.html` at 1200px, and check 768px and 390px widths.

---

## Task 4 — Verify

- `npm run lint` and `npx tsc --noEmit` clean.
- Manually check `/` with: empty DB, one draft only, and a seeded mix of DRAFT/LISTED/SOLD including a SOLD item with `platformFees: null`.
- Check both color schemes (toggle OS appearance or emulate `prefers-color-scheme` in devtools).
- Confirm no page shows duplicate navigation and `/login` has no header.

---

## Suggested agent split

| Agent | Scope | Depends on |
|---|---|---|
| A | Task 1 (shell + nav cleanup) | — |
| B | Task 2 (`lib/dashboard.ts`) | — |
| C | Task 3 (homepage + 4 section components) | A, B |
| D | Task 4 (lint, types, responsive + scheme QA) | C |

A and B are independent and can run in parallel. C must not start until B's exported types are final.

---

## Out of scope for this pass

`/new`, `/listings/[id]`, `/analytics`, bulk multi-select, and per-marketplace crosspost status are separate briefs. Do not touch those screens beyond removing their duplicated nav links in Task 1.

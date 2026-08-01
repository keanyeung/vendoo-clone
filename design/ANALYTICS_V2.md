# Analytics page v2 — time ranges, weekly profit, sold-items ledger

**Visual reference:** `design/analytics-v2.html` (open in a browser — fully interactive: range tabs, granularity tabs, platform filter, column sorting, show-all toggle all work)
**Screenshots:** `design/analytics-v2-month.png`, `design/analytics-v2-week.png`, `design/analytics-v2-alltime.png`

This replaces the existing `/analytics` page. It supersedes `ANALYTICS_SOLD_TABLE.md` — the sold-items table spec here is the current one (it is now range-aware and sortable).

---

## What changes, in one paragraph

The range selector gains **This week** and moves to the top-right as a segmented control (order: This week / This month / This year / All time; **default = This month**). Every number on the page is scoped to the selected range. The KPI row becomes Net profit (with a **vs. previous period delta**), Revenue, Items sold (with avg profit + **avg days to sell**), and Margin/ROI (with a **profit-by-platform share bar**). The profit chart gains a **Day / Week / Month granularity toggle** that auto-picks a sensible default per range. Below it, a **sold-items ledger** lists exactly the sales that produce the numbers above — sold date, platform, sold price, paid, fees, profit, ROI — sortable, platform-filterable, with a totals footer that must reconcile to the KPI cards.

---

## Definitions — get these exactly right, everything else depends on them

```
profit  = sold_price - purchase_price - fees        # fees NULL/absent => 0
roi     = purchase_price > 0 ? profit / purchase_price : null   # render "—" when null
margin  = SUM(profit) / SUM(sold_price)
overall_roi = SUM(profit) / SUM(purchase_price)
days_to_sell = sold_date - listed_at (whole days, floor, min 0)
```

Range bounds (inclusive start, exclusive end; `end = tomorrow 00:00` local):

| Range | Start |
|---|---|
| This week | Monday 00:00 of the current week (**ISO week, Monday start**) |
| This month | 1st of current month 00:00 |
| This year | Jan 1 of current year 00:00 |
| All time | date of the earliest sale |

**Previous period** for the delta = the window of identical length immediately preceding `start` (`[start - span, start)`). Delta = `(profit - prevProfit) / |prevProfit| * 100`. If `prevProfit == 0` render "No profit last week/month/year" in muted grey, not "∞%" or "+100%". For **All time** show "Since {Mon YYYY}" instead of a delta.

All range math is **local time**, computed against the user's clock, never UTC — a Sunday-evening sale must not fall into next week.

> **Implementation override (this repo):** range math is **UTC**, not local. `soldDate` is persisted as UTC
> midnight from a date picker and `lib/dashboard.ts` already buckets in UTC; mixing the two would make the
> homepage and `/analytics` disagree. See `lib/analytics.ts`.

---

## Layout spec

### 1. Header row
Left: `Analytics` (26px/600) with a subline: `This month · 8 sales · Jul 1 – Jul 31, 2026`. For All time the subline reads `All time · 28 sales · since Aug 2025`.
Right: segmented control, 4 buttons in a `1px rgba(255,255,255,.14)` rounded container with 4px inner padding. Active = `#ededed` bg / `#0a0a0a` text / 600. Inactive = transparent / `rgba(255,255,255,.65)` / 500.
Changing the range resets granularity to its per-range default and collapses the table back to 8 rows. Persist the selected range in the URL (`?range=week`) so it survives reload and is linkable.

### 2. KPI cards (4-up grid, 12px gap, `1px rgba(255,255,255,.14)`, radius 12, bg `rgba(255,255,255,.02)`, padding 16/18)

1. **Net profit** — 26px/600 in `#4ade80`; delta line 12px, `#4ade80` up / `#f87171` down / muted when N/A: `▲ 77% vs last month ($215.80)`.
2. **Revenue** — 26px/600; subline `− $281 cost · − $64.60 fees`.
3. **Items sold** — count 26px/600; subline `$48 avg profit · 17 avg days to sell`.
4. **Margin / ROI** — two figures side by side (labels 11px uppercase `.07em`, values 22px/600), then a 6px-tall rounded **platform profit share bar** and a caption `eBay 38% · Facebook 32% · Depop 29%`. Segment colors: eBay `#4ade80`, Depop `#38bdf8`, Facebook `#a78bfa`, other `#71717a`. Only platforms with **positive** profit get a segment; each segment has a `title` tooltip `eBay · $145`.

Zero-state: when a range has no sales, show `$0` / `—` for margin and ROI rather than `NaN%`.

### 3. Profit chart
Title is dynamic: `Profit by day` / `Profit by week` / `Profit by month`, with a matching subline (`Weekly net profit, weeks start Monday.`). Granularity toggle top-right (Day / Week / Month), 3px-padded container, active = `rgba(255,255,255,.12)` bg.

Default granularity per range: **week → day, month → week, year → month, all → month.** All three options stay clickable in every range.

Buckets are generated across the **whole range**, not just from the rows that exist — empty days/weeks/months render as an empty column with a label and no value, so gaps are visible. Bars: 180px track, flex row 8px gap, max bar width 56px, radius `4px 4px 0 0`. Fill = `#4ade80` for the **latest bucket that has sales**, `rgba(74,222,128,.45)` for the rest, `#f87171` for a negative bucket (height uses `abs(value)`). A bucket with sales but a near-zero value gets a 3% minimum height so it doesn't vanish. Value label sits above the bar (hidden when the bucket has no sales); axis label below. Every column has a `title` tooltip: `Week of Jul 27 · $194.90 from 3 sales`.

Bucket labels: day `Mon 27`, week `Jul 27`, month `Jul` — and `Jul '26` when the range is All time (spans years).

### 4. Sold-items ledger
Header: `Sold items` + subline `Every sale behind the numbers above · this month`. Controls right: platform `<select>` (All platforms / eBay / Depop / Facebook) and `Export CSV`.

Columns: **Item** (34px thumbnail + title, 11.5px meta line `Sneakers · Men's 10`) · **Sold** (date `Jul 30, 2026`) · **Platform** (pill) · **Sold price** · **Paid** (muted) · **Fees** (muted, `−$14.30`, `—` in `rgba(255,255,255,.3)` when zero) · **Profit** (600, green/red) · **ROI**. Numeric columns right-aligned, `white-space: nowrap`.

Sortable: Item, Sold, Sold price, Profit, ROI (clicking toggles asc/desc; active header `#ededed` + `⌄`/`⌃`; default **Sold desc**). Platform and Paid are not sortable. Null ROI sorts last in desc. Header cells are real `<button>`s filling the cell so the whole cell is the hit target.

Shows the top 8 rows with a `Show all N` / `Show top 8` toggle in the footer bar. Rows are clickable → item detail (`/items/:id`).

> **Implementation override (this repo):** the item detail route is `/listings/[id]`, not `/items/:id`.

**Totals footer row** (`border-top rgba(255,255,255,.16)`, bg `rgba(255,255,255,.03)`): `N items`, then summed revenue, paid, fees, profit, and blended ROI. These reflect the **filtered** set (so with a platform filter on they will not equal the KPI cards — that's correct and expected). The footer note reads `Totals match the cards above. Sales with no recorded fees count as $0 — 3 items need fees.` where the count links to the filtered listings view for those items.

Empty state (no rows in range/filter): `No sales in this range yet.` + `Mark an item sold from Listings and it shows up here.`

---

## Build plan — subtasks

Ordered so 1 lands first, then 2–5 can be handed out in parallel (they touch different files), then 6 integrates.

### Task 1 — Range + aggregation layer (blocking; do first)
**Files:** `lib/analytics.ts` (new), `lib/analytics.test.ts` (new)
Pure functions, no React, no DB:
```ts
type Range = 'week' | 'month' | 'year' | 'all'
type Sale = { id: string; title: string; category: string; size: string | null;
              soldAt: Date; listedAt: Date; platform: string;
              soldPrice: number; purchasePrice: number; fees: number }

rangeBounds(range: Range, now: Date, earliest: Date): [Date, Date]
previousBounds(start: Date, end: Date): [Date, Date]
summarize(sales: Sale[]): { revenue, cost, fees, profit, count, avgProfit, avgDays, margin, roi }
platformSplit(sales: Sale[]): { platform, profit, share }[]     // positive profit only, desc
bucketProfit(sales, start, end, gran: 'day'|'week'|'month'):
    { key: number; label: string; tipLabel: string; profit: number; count: number }[]
```
`bucketProfit` emits a bucket for **every** interval in `[start, end)` including empty ones. Weeks start Monday.
**Tests (required, they are the spec):** ISO-week boundary (a Sunday 23:00 sale and a Monday 00:00 sale land in different weeks); month boundary; `previousBounds` for a 31-day month vs a 28-day one; `roi === null` when `purchasePrice === 0`; a negative-profit sale; empty input returns zeros not `NaN`; `bucketProfit` over a month with a sale-free week yields that week with `count: 0`.

### Task 2 — Data fetch
**Files:** `app/analytics/page.tsx` (server component or loader), `lib/queries/sales.ts`
One query returning every sold item for `[prevStart, end)` (both the current range and its comparison window in a single round trip), selecting `id, title, category, size, soldAt, listedAt, platform, soldPrice, purchasePrice, fees, thumbnailUrl`. Filter `status = 'sold' AND soldAt IS NOT NULL`, order `soldAt DESC`. Add an index on `(userId, status, soldAt)`. Reads `range` from `searchParams`, defaults to `month`. Do **not** aggregate in SQL — hand the rows to Task 1's functions so the page and the tests share one code path. Guard: if a sold item has `soldAt` but no `purchasePrice`, treat cost as 0 and keep it in the list.

### Task 3 — KPI cards + platform share bar
**Files:** `components/analytics/KpiCards.tsx`, `components/analytics/PlatformShareBar.tsx`
Props: the `summarize()` result for the current range, the same for the previous range, and `platformSplit()`. Pure presentational, no fetching. Formats money with `Intl.NumberFormat('en-US',{style:'currency',currency:'USD'})`, dropping cents when the value is whole. Handles the three delta states (up / down / none) and the all-time "Since Aug 2025" variant. Match the styles in §2 exactly.

### Task 4 — Profit chart
**Files:** `components/analytics/ProfitChart.tsx`
Props: `buckets` from `bucketProfit()`, `gran`, `onGranChange`. CSS-only bars (no chart library). Implements the fill/height/label/tooltip rules in §3, including negative bars and the min-height floor. Granularity is client state seeded from the per-range default; changing the range resets it.

### Task 5 — Sold-items ledger
**Files:** `components/analytics/SoldItemsTable.tsx`, `lib/csv.ts`
Props: the range's sales rows. Client component owning `{ platform, sort, dir, showAll }`. Implements sorting, platform filter, 8-row collapse, totals footer, empty state, row → `/items/:id` navigation, and `Export CSV` (exports the **filtered, sorted** set with a header row: `Item,Sold date,Platform,Sold price,Paid,Fees,Profit,ROI`; filename `sold-items-{range}-{YYYY-MM-DD}.csv`). Numbers in the CSV are raw, unformatted.

### Task 6 — Page assembly + polish
**Files:** `app/analytics/page.tsx`
Compose header + range control (writes `?range=` via `router.replace`, no full reload) + Tasks 3/4/5. Loading skeletons that hold the same heights so nothing jumps. Verify **reconciliation**: with the platform filter on "All platforms", the ledger footer's revenue / cost / fees / profit / ROI must equal the KPI cards to the cent, in every one of the four ranges. Add that as an e2e assertion if the repo has Playwright.

### Task 7 — Responsive
KPI grid: 4-up ≥1024px, 2-up 640–1023px, 1-up below. Chart keeps a 180px track and lets bars get thin; hide value labels under 480px. Under 768px the ledger becomes stacked cards: title + meta on top, then a two-column key/value grid (Sold, Platform, Sold price, Paid, Fees, Profit, ROI) — no horizontal scroll on phones.

---

## Acceptance checklist

- [ ] Four ranges; This month is the default; range persists in the URL.
- [ ] Every KPI, the chart, and the ledger all change together when the range changes.
- [ ] Delta compares against the equal-length preceding window; no `∞%` / `NaN%` anywhere.
- [ ] Granularity defaults to day/week/month per range and can be overridden in any range.
- [ ] Empty buckets render as gaps; the latest bucket with sales is the bright bar.
- [ ] Ledger rows are exactly the sales that sum to the KPI cards (platform filter = All).
- [ ] Footer totals reconcile to the cards to the cent in all four ranges.
- [ ] Missing fees count as $0 and are surfaced as a "N items need fees" link.
- [ ] ROI shows `—` when purchase price is 0; negative profit renders red.
- [ ] Sunday-night and Monday-morning sales land in the correct weeks (local time).
- [ ] No horizontal scroll at 375px.

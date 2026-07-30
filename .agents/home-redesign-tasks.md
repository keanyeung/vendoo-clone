# Home redesign — agent task breakdown

Derived from `design/HOME_REDESIGN.md` (the brief) + `design/home.html` (the visual reference), reconciled
against the actual codebase at commit `b888e5e`. Where this file and the brief disagree, **this file wins** —
the deltas are listed in [Decisions](#decisions) with the reason.

Each task below is written to be handed to one agent verbatim. File ownership is exclusive: no two concurrently
running agents write the same file.

---

## Decisions

Resolved before dispatch. Agents must not re-litigate these.

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Brief says exclude the header from `/login` via `app/login/layout.tsx` | **`AppHeader` is a client component that returns `null` when `usePathname() === "/login"`**, mounted once in `app/layout.tsx` | `app/login/layout.tsx` only returns `children` — it is nested *inside* the root layout and cannot remove what the root renders. The brief's premise is false. Client component also supplies the active-nav highlight the brief wants. |
| D2 | Brief says "this month" = **local** calendar month | **UTC.** Reuse `filterSoldByRange(items, "month" \| "year", now)` from `lib/analytics.ts` | `soldDate` is persisted as UTC midnight from a `YYYY-MM-DD` picker, and `lib/analytics.ts` buckets in UTC. Local bucketing would push a sale entered as Jul 1 into June on any negative-offset server, and homepage totals would disagree with `/analytics`. The brief's `localDate()` citation governs date *entry*, not aggregation. |
| D3 | Brief's `aging_listing` deep link is `/listings?status=LISTED&sort=added-asc` | Use **`/listings?status=LISTED&sort=oldest`** | Both parse to `{field:"added",dir:"asc"}` via `parseSort`, but `app/listings/page.tsx:38 isSortValue()` only accepts `newest \| oldest \| price-high \| price-low`, so `added-asc` leaves the Sort `<select>` displaying "Newest first" while the list is actually oldest-first. `oldest` keeps the control honest. |
| D4 | Brief calls `computeDashboard` "unit-testable" | Ship it pure, but **no unit tests this pass** | There is no test runner in `package.json` and the brief forbids new dependencies. Verification is `tsc` + seeded manual QA (Task D). |
| D5 | `design/home.html` is referenced everywhere but is **not in the repo** | Task 0 commits it before any other agent starts | Otherwise every agent codes against a spec it cannot open. |
| D6 | Striped photo placeholder (`repeating-linear-gradient(45deg,#141414,#1c1c1c)`) | Replace with a flat `bg-black/[.04] dark:bg-white/[.06]` tile | The literal gradient is dark-mode-only and illegible on white. Flat tile matches the existing "No photo" treatment in `app/listings/page.tsx:71`. |

### Known limitation to accept (do not "fix")

The greeting ("Good morning") and the date line use the **server's** local hour, not the visitor's — this page is
server-rendered and the brief forbids client JS here. On Vercel that means UTC. Accept it; do not add a client
component or a hydration-sensitive `Date` read to work around it.

---

## Shared contracts

Frozen before Task C starts. Agents A/B may not change these signatures without a note back.

### `lib/dashboard.ts` exports (Task B)

```ts
export type AttentionItem = {
  kind: "stale_draft" | "aging_listing" | "missing_fees";
  title: string;   // "3 drafts never published"
  detail: string;  // "Oldest added 12 days ago"
  action: string;  // "Review" | "Price" | "Fix"
  href: string;
  count: number;
};

export type DashboardSummary = {
  revenueThisMonth: number;
  profitThisMonth: number;
  salesThisMonth: number;
  revenueYtd: number;
  marginThisMonthPct: number | null;
  activeListings: number;
  draftCount: number;
  soldCount: number;
  inventoryValue: number;
  avgDaysToSell: number | null;
  avgDaysToSellPrevMonth: number | null;
  sellThroughPct: number | null;
  topCategory: string | null;
  bestMonth: MonthlyBucket | null;
  avgProfitPerItem: number | null;
  monthly: MonthlyBucket[];   // ADDED vs brief: last <=6 all-time buckets, oldest first
  recent: ItemDto[];          // 5 most recently updated, any status
  attention: AttentionItem[]; // <=3, count desc
  totalItems: number;         // ADDED vs brief: drives the empty state without a second query
};

export function computeDashboard(items: ItemDto[], now: Date): DashboardSummary;
```

`monthly` and `totalItems` are additions to the brief's type so that `app/page.tsx` never calls
`computeAnalytics` itself — one aggregate call, one source of truth.

### `lib/platform-label.ts` (Task B, new file)

```ts
export const PLATFORM_LABELS = {
  FB_MARKETPLACE: "Facebook Marketplace",
  DEPOP: "Depop",
  EBAY: "eBay",
} satisfies Record<NonNullable<ItemDto["soldPlatform"]>, string>;
```

Extracted so `DashboardListings` can render "sold Jul 24 on eBay". `app/listings/[id]/page.tsx:55` has an
identical private copy — **leave it alone this pass** (out of scope), note it for a follow-up.

### Design-token translation table

The reference HTML is dark-only. Never hardcode its hex values. Use these pairs — all already in the codebase.

| Reference | Use |
|---|---|
| page `#0a0a0a` / text `#ededed` | inherited from `<body>`; add nothing |
| card border `rgba(255,255,255,.14)` | `border-black/15 dark:border-white/20` |
| header border `rgba(255,255,255,.12)` | `border-black/10 dark:border-white/15` |
| header bg `rgba(10,10,10,.9)` + `blur(8px)` | `bg-background/90 backdrop-blur-sm` |
| card bg `rgba(255,255,255,.02)` | `bg-black/[.02] dark:bg-white/[.02]` |
| row divider `rgba(255,255,255,.07)` | `border-black/[.06] dark:border-white/10` |
| chip / hover fill `rgba(255,255,255,.05)` | `bg-black/[.04] dark:bg-white/[.06]` |
| active nav fill `rgba(255,255,255,.09)` | `bg-black/[.06] dark:bg-white/[.09]` |
| muted text `.4 / .45 / .5 / .55 / .6` | collapse all onto `text-black/60 dark:text-white/60` |
| green `#4ade80` (value text) | `text-green-700 dark:text-green-400` |
| green `#4ade80` (current bar) | `bg-green-600/70 dark:bg-green-400/70` |
| green `rgba(74,222,128,.35)` (past bars) | `bg-green-600/30 dark:bg-green-400/35` |
| sold badge `rgba(20,83,45,.5)` / `#bbf7d0` | `STATUS_STYLES.SOLD.className` |
| radius 12 / 8 / 6 px | `rounded-xl` / `rounded-lg` / `rounded-md` |
| 60px bar, 104px chart, 48px thumb | `h-15`, `h-26`, `size-12` (Tailwind v4 dynamic spacing) |
| 28 / 26 / 15 / 13 / 12 / 11 px type | `text-[28px]`, `text-[26px]`, `text-[15px]`, `text-[13px]`, `text-xs`, `text-[11px]` |

### House conventions every agent must follow

Verified in the existing source; deviating from these is a review failure.

1. **Server components by default.** The only client component in this whole change is `AppHeader` (D1).
2. **`new Date()` / `Date.now()` inside a component body trips the `react-hooks/purity` lint rule.** Capture the
   value once and silence it exactly the way `app/listings/page.tsx:118-120` does:
   ```ts
   // Capture one request-time value so every block agrees.
   // eslint-disable-next-line react-hooks/purity
   const now = new Date();
   ```
3. **`export const dynamic = "force-dynamic"`** on DB-backed pages. Still valid on Next 16.2.11 here —
   `cacheComponents` is not enabled in `next.config.ts`. Matches `app/listings/page.tsx:14`.
4. **Images:** plain `<img>` preceded by `{/* eslint-disable-next-line @next/next/no-img-element */}`. Remote
   Supabase hosts are not configured for `next/image`.
5. **Currency:** module-level `new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })`. The
   reference drops cents (`maximumFractionDigits: 0`); the codebase does not. **Keep cents** for consistency
   with `/listings` and `/analytics`.
6. **Tap targets:** `min-h-11` on interactive elements. For the 60px header bar use
   `inline-flex items-center min-h-11` so links stay visually small but remain 44px targets.
7. **Comments** explain *why*, never *what* — match the density in `lib/analytics.ts`.
8. No new dependencies. No changes to `prisma/schema.prisma`.

---

## Task 0 — Materialize the design reference — ✅ DONE

**Owned:** `design/**`.

The original handoff bundle was copied in from `~/Downloads/UI changes exploration (1)/handoff/`, wholesale, as
`design/` — the layout its own `README.md` prescribes. Files now present:

| Path | What it is |
|---|---|
| `design/HOME_REDESIGN.md` | The brief this breakdown expands (**not** at repo root) |
| `design/home.html` | Visual reference, homepage — the real markup lives in its `<script type="__bundler/template">` tag |
| `design/home-dashboard.png` | Screenshot, homepage |
| `design/README.md` | Handoff index + the designer's stated order of work |
| `design/NEW_LISTING_REDESIGN.md`, `design/new-listing.html`, `design/new-listing-*.png` | The `/new` brief — **out of scope this pass**, present for the follow-up |

Verified: nothing under `design/` is gitignored; `home.html` carries all four `__bundler` script tags and
renders the dashboard in a browser.

Note from `design/README.md`: the `/new` brief assumes `AppHeader` already exists, so **Task A is the gate for
both briefs** — do not start the `/new` work until A has landed.

---

## Task A — App shell + nav cleanup

**Depends on:** Task 0.
**Runs in parallel with:** Task B.
**Owns (exclusive):** `components/AppHeader.tsx` (new), `app/layout.tsx`, `app/listings/page.tsx`,
`app/listings/[id]/page.tsx`, `app/analytics/page.tsx`, `app/new/page.tsx`.
**Must NOT touch:** `app/page.tsx` (Task C owns it — see A.6), `lib/**`, `components/Dashboard*`.

**Read first (do not infer):** `app/layout.tsx`, `app/login/layout.tsx`, `app/login/page.tsx`,
`app/actions/auth.ts`, `app/page.tsx`, `app/listings/page.tsx`, `app/listings/[id]/page.tsx`,
`app/analytics/page.tsx`, `app/new/page.tsx`, `app/globals.css`, `proxy.ts`.

### A.1 — `components/AppHeader.tsx`

```tsx
"use client";
```

- `usePathname()` from `next/navigation`. **`if (pathname === "/login") return null;`** — see D1.
- Import `logout` from `@/app/actions/auth` and use it directly as `<form action={logout}>`. Importing a
  `"use server"` action into a client component is supported; do **not** pass it down as a prop from the layout.
- Structure, matching `design/home.html`:
  - `<header className="sticky top-0 z-10 border-b border-black/10 bg-background/90 backdrop-blur-sm dark:border-white/15">`
  - inner `<div className="mx-auto flex h-15 max-w-[1120px] items-center justify-between gap-6 px-6">`
  - **Left cluster** (`flex items-center gap-7`):
    - wordmark `<Link href="/">Vendoo Clone</Link>` — `text-[15px] font-semibold tracking-tight`
    - `<nav className="flex items-center gap-1">` with Home `/`, Listings `/listings`, Analytics `/analytics`
    - each link: `inline-flex min-h-11 items-center rounded-md px-2.5 text-sm`; active adds
      `bg-black/[.06] font-medium dark:bg-white/[.09]`, inactive adds `text-black/60 dark:text-white/60`
    - active test: `pathname === "/"` for Home; `pathname === href || pathname.startsWith(href + "/")` for the
      others, so `/listings/[id]` keeps Listings highlighted. Add `aria-current="page"` on the active link.
  - **Right cluster** (`flex items-center gap-2`):
    - `<Link href="/new">` — `inline-flex min-h-11 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-sm font-semibold text-background`, with a leading `<span aria-hidden="true">+</span>`
    - `<form action={logout}><button type="submit" …>Log out</button></form>` — bordered:
      `min-h-11 rounded-md border border-black/15 px-3 text-sm text-black/70 hover:bg-black/[.04] dark:border-white/20 dark:text-white/70 dark:hover:bg-white/[.06]`
- No `useState`, no effects. `usePathname` only.

### A.2 — `app/layout.tsx`

Mount `<AppHeader />` as the first child of `<body>`, above `{children}`. Nothing else changes — keep
`min-h-full flex flex-col` on the body and both font variables.

### A.3–A.5 — remove the now-duplicated nav

- `app/listings/page.tsx`: delete the `← Back to home` `<Link>` (lines ~141-146) **and** the "New Listing" /
  "Analytics" buttons in the header row (~157-170). Keep the `<h1>` + count block; drop the now-empty
  `sm:flex-row sm:justify-between` wrapper if it has one child left. Remove the `Link` import only if nothing
  else in the file uses it (the grid cards do — verify before removing).
- `app/analytics/page.tsx`: delete the `← Back to home` link (~54-59) and drop `Link` from the imports **only
  if** unused afterwards (the empty states use it — check).
- `app/new/page.tsx`: delete the `← Back to home` link (~133-135); `Link` is still used by "View listings".
- `app/listings/[id]/page.tsx`: **keep** `← Back to listings` (hierarchy, not nav). Restyle to sit under the new
  header: `inline-flex min-h-11 items-center text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white`.

### A.6 — `app/page.tsx` handoff

Task C rewrites this file wholesale. **Task A must not edit it.** If A finishes first, the old button row on `/`
will double up with the header until C lands — that is expected and acceptable mid-flight.

**Acceptance**
- Header renders on `/`, `/listings`, `/listings/[id]`, `/analytics`, `/new`; renders nothing on `/login`.
- Active pill follows the route, including `/listings/[id]` → Listings.
- Log out still ends the session and redirects to `/login`.
- No page renders its own Home/Listings/Analytics/New-listing links any more.
- `npm run lint` and `npx tsc --noEmit` clean.
- Legible in both color schemes.

---

## Task B — `lib/dashboard.ts` + `lib/platform-label.ts`

**Depends on:** Task 0.
**Runs in parallel with:** Task A.
**Owns (exclusive):** `lib/dashboard.ts` (new), `lib/platform-label.ts` (new).
**Must NOT touch:** `lib/analytics.ts`, `lib/listing-sort.ts`, any `app/**` or `components/**` file.

**Read first:** `lib/analytics.ts` (all of it), `lib/listing-sort.ts`, `lib/item-dto.ts`, `prisma/schema.prisma`.

Implement exactly the [Shared contracts](#shared-contracts) signature. Rules:

### Reuse, never reimplement
- Per-item profit → `computeProfit(item)`. Never inline `soldPrice - purchasePrice - fees`.
- This-month set → `filterSoldByRange(items, "month", now)`. YTD set → `filterSoldByRange(items, "year", now)`.
- All-time roll-up → `computeAnalytics(items, "all", now)`; take `avgProfitPerItem` and `monthly` from it.
- Days listed / days to sell → `daysListed(item, now.getTime())`. It already returns
  `soldDate - createdAt` for sold items and `now - createdAt` otherwise, which is exactly both definitions
  the brief asks for.

### Field-by-field
| Field | Rule |
|---|---|
| `revenueThisMonth` | Σ `soldPrice ?? 0` over the month set |
| `profitThisMonth` | Σ `computeProfit(item) ?? 0` over the month set |
| `salesThisMonth` | `monthSet.length` |
| `revenueYtd` | Σ `soldPrice ?? 0` over the year set |
| `marginThisMonthPct` | `revenueThisMonth === 0 ? null : profit/revenue*100`, rounded to 1dp |
| `activeListings` | count `status === "LISTED"` |
| `draftCount` | count `status === "DRAFT"` |
| `soldCount` | count `status === "SOLD"` |
| `inventoryValue` | Σ `listPrice` over LISTED only |
| `avgDaysToSell` | mean `daysListed` over SOLD **with non-null `soldDate`**; `null` when none. Round to whole days |
| `avgDaysToSellPrevMonth` | same, restricted to sales in the previous **UTC** month. Write a private `isInUtcMonth(iso, year, monthIndex)`; handle the January→December year rollback |
| `sellThroughPct` | `soldCount + activeListings === 0 ? null : soldCount/(soldCount+activeListings)*100`, 1dp |
| `topCategory` | group SOLD items by `category` (skip `null`), sum `computeProfit ?? 0`, return the highest. Ties → alphabetically first, for render stability. `null` when no categorized sales |
| `bestMonth` | `monthly` bucket with max `profit`; `null` for an empty array |
| `avgProfitPerItem` | straight from `computeAnalytics(...,"all").avgProfitPerItem` |
| `monthly` | `computeAnalytics(...,"all").monthly.slice(-6)` |
| `recent` | `[...items].sort(desc by Date.parse(updatedAt)).slice(0,5)`; tie-break on `id` so ordering is deterministic |
| `totalItems` | `items.length` |

### Attention rules
Emit only when `count > 0`; sort by `count` desc (tie-break by the `kind` order below); `slice(0, 3)`.

| kind | Predicate | title | detail | action | href |
|---|---|---|---|---|---|
| `stale_draft` | `status === "DRAFT"` and `daysListed > 7` | `"{n} draft(s) never published"` | `"Oldest added {m} days ago"` | `Review` | `/listings?status=DRAFT` |
| `aging_listing` | `status === "LISTED"` and `daysListed > 45` | `"{n} listing(s) over 45 days"` | `"Consider a price drop"` | `Price` | `/listings?status=LISTED&sort=oldest` (D3) |
| `missing_fees` | `status === "SOLD"` and `platformFees === null` | `"{n} sale(s) missing fees"` | `"Profit is overstated"` | `Fix` | `/listings?status=SOLD` |

Singular/plural both branches ("1 draft never published" / "3 drafts never published"). `platformFees` defaults
to `0` in the schema but `app/api/items/[id]/route.ts:106` can write `null`, so this rule is reachable.

### Purity
No Prisma import. No `Date.now()` / `new Date()` inside — everything derives from the `now` argument. Empty
input must return zeros and `null`s without throwing or dividing by zero. Round money to 2dp and percentages to
1dp **once, at return**, mirroring the comment at `lib/analytics.ts:216`.

**Acceptance:** `npx tsc --noEmit` clean; `npm run lint` clean; `computeDashboard([], new Date())` returns a
fully-populated object with empty arrays; no import of `@/lib/db` or `@prisma/client` runtime values.

---

## Task C — Homepage + section components

**Depends on:** A **and** B both merged (C imports `AppHeader`'s layout width and B's types).
**Owns (exclusive):** `app/page.tsx` (rewrite), `components/DashboardMetrics.tsx`,
`components/DashboardListings.tsx`, `components/DashboardAnalytics.tsx`, `components/DashboardAttention.tsx`,
`components/DashboardEmptyState.tsx`.
**Must NOT touch:** `lib/**`, `components/AppHeader.tsx`, any other page.

**Read first:** `design/home.html` (the `__bundler/template` script tag holds the real markup — read it, do not
guess from the screenshot), `design/home-dashboard.png`, `lib/dashboard.ts`, `lib/status-style.ts`,
`lib/platform-label.ts`, `components/ProfitChart.tsx`, `app/analytics/page.tsx`, `app/listings/page.tsx`.

Split into four sub-tasks if you fan out further; they share only the `DashboardSummary` type.

### C.0 — `app/page.tsx`

```ts
export const dynamic = "force-dynamic";
```
- `async function Home()` — no `PageProps` generic needed, `/` takes no params.
- `const items = await prisma.item.findMany();`
- Capture `now` once with the `react-hooks/purity` eslint-disable (convention #2), pass it to `computeDashboard`.
- `<main className="mx-auto w-full max-w-[1120px] flex-1 px-6 pt-8 pb-16">`.
- Greeting row: `flex flex-wrap items-end justify-between gap-4`
  - `<h1 className="text-[28px] font-semibold tracking-tight">` — `"Good morning"` (<12), `"Good afternoon"`
    (<18), else `"Good evening"`, from `now.getHours()`.
  - subline `mt-1.5 text-sm text-black/60 dark:text-white/60`, built from `summary.attention`:
    join the first two items' short phrases with `" and "` → `"3 drafts waiting and 2 listings going stale."`.
    Phrase per kind: `stale_draft` → `"{n} draft(s) waiting"`, `aging_listing` → `"{n} listing(s) going stale"`,
    `missing_fees` → `"{n} sale(s) missing fees"`. When `attention` is empty:
    `"Everything is up to date."`.
  - right: `<span className="text-[13px] text-black/60 dark:text-white/60">` with
    `now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })`.
- Then `<DashboardMetrics …/>`, then the two-column body — **or** `<DashboardEmptyState />` when
  `summary.totalItems === 0`, in which case the metrics grid is omitted entirely (brief's explicit instruction).
- Two-column wrapper:
  `<div className="mt-3 grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">`
  with the right column as `<div className="flex flex-col gap-3">`.

### C.1 — `components/DashboardMetrics.tsx`

Props: the four values it needs off `DashboardSummary` (or the whole summary — pick one and be consistent
across all four components).

- `<section className="mt-7 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">`
- Card: `rounded-xl border border-black/15 bg-black/[.02] px-4.5 py-4 dark:border-white/20 dark:bg-white/[.02]`
- Label: `text-[11px] font-semibold uppercase tracking-[.07em] text-black/60 dark:text-white/60`
- Value: `mt-2.5 text-[26px] font-semibold tracking-tight`
- Sub: `mt-1.5 text-xs text-black/60 dark:text-white/60`

| Card | Value | Sub |
|---|---|---|
| Revenue this month | `revenueThisMonth` | `"{salesThisMonth} sale(s) · {revenueYtd} YTD"` |
| Profit this month | `profitThisMonth`, tinted `text-green-700 dark:text-green-400` when `>= 0`, `text-red-700 dark:text-red-400` when `< 0` (same pair as `app/analytics/page.tsx:101-104`) | `"{marginThisMonthPct}% margin"`, or `"no revenue yet"` when null |
| Active listings | `activeListings` | `"{inventoryValue} inventory value"` |
| Avg days to sell | `avgDaysToSell ?? "—"` | `"down from {prev} last month"` / `"up from {prev} last month"` / `"same as last month"`; when either value is null → `"not enough sales yet"` |

### C.2 — `components/DashboardListings.tsx`

- Card shell: `overflow-hidden rounded-xl border border-black/15 bg-black/[.02] dark:border-white/20 dark:bg-white/[.02]`
- Header row (`flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4.5 dark:border-white/15`):
  - `<h2 className="text-base font-semibold">Listings</h2>`
  - sub `"{activeListings} active · {draftCount} drafts · {soldCount} sold all time"`
  - `<Link href="/listings">View all →</Link>` — bordered pill,
    `inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-[13px] font-medium text-black/60 dark:border-white/20 dark:text-white/60`
- Chip row (`flex flex-wrap gap-2 border-b … px-5 py-3.5`), one `<Link>` per status to
  `/listings?status=LISTED|DRAFT|SOLD`: `inline-flex min-h-11 items-baseline gap-1.5 rounded-lg bg-black/[.04] px-3 text-[13px] text-black/60 dark:bg-white/[.06] dark:text-white/60` with the count in
  `<b className="text-[15px] font-semibold text-foreground">`.
- Rows: `summary.recent.map(...)`, each a `<Link href={`/listings/${item.id}`}>` with
  `flex items-center gap-3.5 border-b border-black/[.06] px-5 py-3 last:border-b-0 hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/[.04]`:
  1. Thumb: `item.photos[0]` → `<img className="size-12 shrink-0 rounded-lg object-cover" alt="" />` with the
     `no-img-element` disable comment; absent → `<div className="size-12 shrink-0 rounded-lg bg-black/[.04] dark:bg-white/[.06]" />` (D6). `alt=""` is correct — the title next to it is the accessible name.
  2. Text block `min-w-0 flex-1`: title `truncate text-sm font-medium`; meta
     `mt-0.5 text-xs text-black/60 dark:text-white/60`.
     - SOLD → `"{category} · {size} · sold {Mon D} on {PLATFORM_LABELS[soldPlatform]}"`
     - otherwise → `"{category} · {size} · {daysListed} days listed"` (`"added N days ago"` reads better for
       DRAFT — match the reference, which uses "added 8 days ago" for the draft row)
     - drop null segments and join surviving ones with `" · "`; never render a stray separator.
  3. Badge: `STATUS_STYLES[item.status]` → `shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold {className}`.
  4. Price: `w-18 shrink-0 text-right text-sm font-semibold` with `listPrice` (the reference shows list price on
     every row, including sold ones).
- Empty `recent` cannot happen when `totalItems > 0`, but guard anyway.

### C.3 — `components/DashboardAnalytics.tsx`

Server-rendered, zero client JS — follow `components/ProfitChart.tsx`'s inline-`style` percentage-height
approach. Do **not** import `ProfitChart` itself; it is a different, taller design with a table.

- Header: "Analytics" + `"Profit, last 6 months"` + `<Link href="/analytics">Open →</Link>` (same pill as View all).
- Chart body `p-5`:
  - `<div aria-hidden="true" className="flex h-26 items-end gap-2">` — one column per bucket in
    `summary.monthly`, `flex-1 flex flex-col justify-end h-full gap-1.5`.
  - Bar height: `maxAbs = Math.max(...monthly.map(b => Math.abs(b.profit)))`; height
    `maxAbs === 0 ? "2px" : \`${Math.max((Math.abs(b.profit)/maxAbs)*100, 3)}%\`` — the exact zero-guard from
    `ProfitChart.tsx:41-44`. Rounded `rounded-t-sm`.
  - Current month = `b.key` equal to now's UTC `YYYY-MM` → `bg-green-600/70 dark:bg-green-400/70`; all others
    `bg-green-600/30 dark:bg-green-400/35`.
  - Month label under each bar: `text-[11px] text-center text-black/60 dark:text-white/60`. `bucket.label` is
    `"Jul 2026"` (`month: "short", year: "numeric"`) but the design shows `"Jul"` — derive the short label from
    `bucket.key` (`"2026-07"` → `"Jul"`), do not restyle `lib/analytics.ts`.
  - Because the bars are `aria-hidden`, add an `<caption className="sr-only">`-equivalent: a
    `<p className="sr-only">` sentence naming each month and its profit, so the chart is not invisible to
    screen readers.
- `<dl className="mt-4.5 grid grid-cols-2 gap-3.5">` with Best month (`"{Mon} · {profit}"`), Avg / item,
  Top category, Sell-through (`"{n}%"`). `dt` = the 11px uppercase muted label; `dd` = `mt-1 text-[15px] font-semibold`. Every one renders `"—"` when its source is null.
- If `monthly` is empty, render the header + a single muted "No sales recorded yet" line instead of the chart.

### C.4 — `components/DashboardAttention.tsx`

- Header block `px-5 pt-4.5 pb-3.5 border-b …`: `<h2>Needs attention</h2>` + `"{Σ count} item(s) to deal with"`.
- One row per `AttentionItem`: `flex items-center justify-between gap-3 border-b border-black/[.06] px-5 py-3.5 last:border-b-0 dark:border-white/10`
  - left `min-w-0`: `title` at `text-sm font-medium`, `detail` at `mt-0.5 text-xs` muted
  - right: `<Link href={a.href}>{a.action}</Link>` — `inline-flex min-h-11 shrink-0 items-center rounded-md border border-black/15 px-2.5 text-xs font-semibold dark:border-white/20`
- Empty `attention` → render the card with a muted `"Nothing needs attention right now."` row. Do not hide the card.

### C.5 — `components/DashboardEmptyState.tsx`

Shown instead of the metrics grid **and** the two-column body when `totalItems === 0`:
centered card `mt-7 rounded-xl border border-black/15 px-6 py-12 text-center dark:border-white/20`, `<h2>Add your first item</h2>`, one muted line, and a primary
`<Link href="/new">New listing</Link>` styled like the other primary buttons. Mirror the tone of the existing
empty state at `app/listings/page.tsx:186-198`.

**Acceptance**
- `/` renders from real DB rows; every link resolves (`/listings`, `/listings?status=…`, `/listings/{id}`,
  `/analytics`, `/new`).
- No `"use client"` in any file this task creates.
- Side-by-side with `design/home.html` at 1200px: same block order, same relative proportions, same copy.
- `npm run lint` + `npx tsc --noEmit` clean.

---

## Task D — Verification

**Depends on:** C.
**Owns:** no source files. May file fixes back to A/B/C owners, or apply them directly if those agents are done.

1. `npm run lint` and `npx tsc --noEmit` — both clean.
2. `npm run build` — catches typed-route errors that `tsc` alone misses.
3. **Seed three states** and screenshot `/` in each. There is no seed script in the repo; write a throwaway one
   under the scratchpad (do not commit it) or use the running app:
   - empty DB → empty state visible, metrics grid absent, no crash;
   - one DRAFT only → `avgDaysToSell` shows `—` / "not enough sales yet", chart shows its no-sales line,
     attention shows only `stale_draft` (or nothing if the draft is <7 days old);
   - mixed DRAFT/LISTED/SOLD **including** one SOLD row with `platformFees: null`, one LISTED row older than
     45 days, and sales spread over ≥7 months → all three attention rows appear, chart clips to 6 bars.
4. **Cross-check the numbers against `/analytics`**: with range=This month, `totalRevenue` there must equal
   `revenueThisMonth` on `/`, and `avgProfitPerItem`/best month must match. Any drift means D2 was violated
   somewhere.
5. **Both color schemes** — emulate `prefers-color-scheme` in devtools. Every border, chip, badge, bar and
   muted line must be legible on white.
6. **Widths 1200 / 768 / 390px**: 4→2→1 metric columns, two-column body collapses at `lg`, no horizontal
   scrollbar on `<body>`, titles truncate rather than wrap.
7. **Nav audit:** header on every route, absent on `/login` (log out and confirm), active pill correct on
   `/listings/[id]`, no page rendering its own duplicate nav.
8. **Keyboard pass:** tab through the header and the dashboard; every interactive element is reachable, shows a
   focus ring, and is ≥44px.

---

## Dispatch order

```
Task 0  (blocking, alone)
   │
   ├── Task A  ──┐
   └── Task B  ──┤   (parallel — disjoint file sets)
                 ▼
              Task C   (C.0 first to fix props, then C.1–C.5 in parallel)
                 ▼
              Task D
```

**Collision guards**
- A and B share no files. A owns `app/**` except `app/page.tsx`; B owns `lib/**` new files only.
- C must not start before B's exports are merged — its four components are typed against `DashboardSummary`.
- If C is fanned out to four agents, C.0 lands first so the prop shapes are fixed; the four component files are
  then disjoint.

## Out of scope (do not touch)

`/new`, `/listings/[id]`, `/analytics` beyond their nav-link removal in Task A. No bulk multi-select, no
per-marketplace crosspost status, no `prisma/schema.prisma` edits, no new dependencies. The duplicated
`statusStyles` const in `app/listings/[id]/page.tsx:35` and its private `platformLabels` are known duplication —
leave them for a follow-up pass.

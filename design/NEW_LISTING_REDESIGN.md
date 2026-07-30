# New Listing redesign — implementation brief

**Goal:** rebuild `/new` so a listing goes from photos → posted → saved without scrolling past redundant blocks. One responsive component: two columns on desktop, single column + sticky action bar on phone.

**Visual reference:** `design/new-listing.html` — open in a browser and read the source. Use the **Turn 2** section at the top (`id="2a"` desktop, `id="2b"` phone). Turn 1 (`1a`/`1b`/`1c`) below it is a superseded exploration — **ignore it except for `1c`**, which is the post-save screen and IS in scope. Flat screenshots: `design/new-listing-desktop.png`, `design/new-listing-phone.png`.

**Stack (do not change):** Next.js App Router, Tailwind v4, Prisma, Zod. No new dependencies. Reference HTML is dark-mode only — translate literal colors to the existing Tailwind pairs (`border-black/15 dark:border-white/20`, `text-black/60 dark:text-white/60`), never hardcode `#0a0a0a`.

**Depends on:** `HOME_REDESIGN.md` Task 1 (the `AppHeader` shell). If that is not merged yet, do it first — this screen assumes the header exists and that `/new` no longer renders its own "← Back to home" link.

---

## 0. Ground rules

- Read every file before editing it. Do not infer contents.
- Files in play: `app/new/page.tsx`, `components/ItemForm.tsx`, `components/PhotoUploader.tsx`, `components/CopyListingSection.tsx`, `lib/analysis-schema.ts`, `lib/item-schema.ts`, `lib/listing-text.ts`, `lib/upload-limits.ts`.
- Analysis stays **manual** — keep the explicit "Analyze photos" / "Re-analyze" button. Do not auto-trigger on upload.
- Do not change the `/api/analyze`, `/api/upload`, or `/api/items` contracts except where Task 5 says so.
- Preserve existing a11y conventions: `role="alert"` on errors, `aria-live="polite"` on the analyzing state, `aria-pressed` on the platform tabs, `min-h-11` tap targets.

---

## Task 1 — Delete what's redundant

**File:** `app/new/page.tsx`.

Remove entirely:

1. **The bottom "Uploaded photos" section** — the `{uploadedUrls.length > 0 && (...)}` block that renders every photo full-size with its raw Supabase URL underneath. `PhotoUploader` already shows the thumbnails. This is debug output.
2. **The `<details>` "Raw JSON" block** and the `JSON.stringify(analysis, null, 2)` inside it.
3. **The `<h1>` sub-line "Step one: add photos of the item you want to list."** — replaced by the step indicator in Task 2.

**File:** `components/ItemForm.tsx`.

4. **Remove the Summary field** — the `summary` state, its `<textarea>`, and its `ErrorText`. Keep sending `summary` in the POST payload as `null`, or drop it from the payload if `CreateItemSchema` allows — read `lib/item-schema.ts` and decide, but **do not** loosen a schema that requires it without checking `lib/listing-text.ts` first, which reads `item.summary` when building the copy text. If the copy text needs it, keep generating it from the analysis and store it invisibly rather than showing an editable field.

**Acceptance:** `/new` after analysis shows each photo exactly once, no JSON dump, no Summary input.

---

## Task 2 — Reorder and restructure the page

**File:** `app/new/page.tsx`.

New order after a successful analysis:

1. Page title "New listing" + a 3-step indicator (`Photos ✓ › Analyzed ✓ › Post & save`). Purely presentational.
2. **Photos** — collapsed to a compact strip once photos exist (see Task 3).
3. **`CopyListingSection`** — "Post it". **This moves above the form.** The user copies to the marketplace first, then saves.
4. **`ItemForm`** — "Review item details".

The single `CopyListingSection` instance currently rendered *after* the form inside `ItemForm.tsx` (`<CopyListingSection item={buildItemDto("preview", "LISTED")} />`) must be **lifted out of `ItemForm`** and rendered by the page above it.

**This is the one structurally tricky part.** The copy text is built from live, unsaved form values via `buildItemDto`, so moving the block above the form means the form's state must live above it too. Two acceptable approaches — pick one and be consistent:

- **(a) Lift state to the page.** Move the ~15 `useState` calls out of `ItemForm` into `app/new/page.tsx` (or a `useItemDraft()` hook in `lib/`), pass values + setters down to `ItemForm`, and pass the derived `ItemDto` to `CopyListingSection`. Cleanest, biggest diff.
- **(b) Keep state in `ItemForm`, hoist the render.** `ItemForm` accepts a `renderAbove?: (item: ItemDto) => ReactNode` prop and calls it with `buildItemDto("preview", "LISTED")` before its `<form>`. Smaller diff, slightly awkward API.

Prefer **(a)**. Whichever is chosen, the copy preview must stay live — editing List price in the form must update the price shown in the copy block without a save.

**Acceptance:** Post it renders above Review item details; typing in the form updates the copy preview immediately.

---

## Task 3 — Responsive layout

**File:** `app/new/page.tsx` (plus a wrapper if it helps).

Breakpoint: **`lg` (1024px)** in Tailwind terms — the reference calls it 900px; use `lg` and verify it feels right.

**Desktop (`lg` and up)** — reference `id="2a"`:
- Page container widens to `max-w-[1120px]`.
- Header row: title + subtitle on the left; usage line, "Re-analyze", and a primary "Save as listed" on the right.
- Body is `grid grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-4 items-start`.
- **Left column:** photos card (3-up square grid, caption "N photos · first is the cover", a "Manage" button) and below it the Post it card with `sticky top-5`.
- **Right column:** the review form. Priority fields (Title, Description, List price, Purchase price) first, then an "Item attributes" group (brand, category, size, color, condition, purchase date, condition notes, keywords, notes) **expanded inline** — no disclosure on desktop.

**Phone (below `lg`)** — reference `id="2b"`:
- Single column, 16px page padding.
- Photos become a **horizontally scrolling strip** of 76px squares plus a `+` tile.
- Post it renders inline with the full preview text and the platform chips, but **without** its own copy buttons.
- Form fields stack full-width. **All inputs must be `text-base` (16px) or larger** — anything smaller makes iOS Safari zoom on focus. The current `control` class already uses `text-base`; keep it.
- Item attributes collapse behind a **"More details" disclosure**, collapsed by default, with a muted summary of the values (`Starter · T-Shirt · XL`).
- A **sticky bottom action bar**: `fixed bottom-0 inset-x-0 lg:static lg:hidden`, top border, translucent background with `backdrop-blur`, containing a full-width primary **"Copy for {platform}"** and a secondary **"Save"**. The label tracks the selected platform chip. Add `pb-[env(safe-area-inset-bottom)]` and enough bottom padding on the scroll container that the bar never covers the last field.

**Acceptance:** verify at 1440px, 1024px, 768px, and 390px. No horizontal scroll at any width. The bottom bar appears only below `lg`.

---

## Task 4 — Field-level changes

**File:** `components/ItemForm.tsx`.

1. **Purchase price becomes required.** It is the only value the AI cannot supply and analytics is wrong without it.
   - Update `CreateItemSchema` in `lib/item-schema.ts` so `purchasePrice` is a required non-negative number (read the file first — it may already be required but silently coerced from `Number.NaN`; the current code passes `Number.NaN` when the field is blank, which is the bug that lets it through).
   - Render it with an error-styled border and the helper "Required — profit and ROI can't be tracked without it." until filled.
   - Disable "Save as listed" while it is empty. **"Save as draft" must stay enabled** — a draft is explicitly incomplete.
2. **Condition is promoted** out of the attributes group into the priority field set, directly after List price and Purchase price, on **both** layouts. Options come from `CONDITION_VALUES` in `lib/analysis-schema.ts`. Add a muted helper: "AI read this as **{condition}** from the photos."
3. **List price gains inline AI reasoning.** Directly under the input, in a subtle panel:
   - line 1, semibold: `AI suggests $45 · range $30–$65 · high confidence`
   - line 2, muted: the first **two sentences** of `price_reasoning`.
   This **replaces** the standalone "AI pricing reference" `<aside>` — delete that aside. On desktop, keep the full reasoning available as a collapsed `<details>` labelled "Why this price?".
4. **Keywords become chips.** Render each keyword as a removable pill with an `×`, plus a `+ add` affordance, instead of one comma-separated `<input>`. Keep the stored shape as `string[]` — this is presentation only. If this balloons the estimate, ship the comma input and flag it; it is the lowest-priority item here.
5. **Both money inputs keep `onWheel={(e) => e.currentTarget.blur()}`** — that guard already exists and must survive the refactor.

---

## Task 5 — Price reasoning length (API-side)

**File:** `lib/analysis-schema.ts`.

`price_reasoning` is currently described as "Two to four sentences". The new UI shows **two**. Tighten the `.describe()` to request exactly two sentences, no more than ~45 words, and keep the guidance about differing across eBay / Depop / Facebook Marketplace.

Do **not** change the field name or type — only the description string that steers the model. Verify `/api/analyze` still parses (read `app/api/analyze/route.ts` first).

If truncating client-side is preferred instead, split on sentence boundaries and take the first two — but prefer fixing the prompt.

---

## Task 6 — Usage line with cost

**File:** `app/new/page.tsx`, and wherever usage is returned by `app/api/analyze/route.ts`.

Current line: `9,970 input tokens · 443 output tokens · claude-opus-4-8`.
New line: `9,970 in · 443 out · claude-opus-4-8 · $0.18`.

- Compute the dollar cost from token counts and a per-model rate table. Put the table in `lib/anthropic.ts` (read it first) or a new `lib/model-pricing.ts` as a plain `Record<string, { inputPer1M: number; outputPer1M: number }>`.
- Format to 2 decimals; show `<$0.01` rather than `$0.00`.
- **If the model is not in the table, omit the cost** rather than guessing — never render a wrong number.
- Placement: right-aligned in the header row on desktop, centered under the form on phone. Muted, 11–12px.

---

## Task 7 — Post-save screen

**File:** `app/new/page.tsx` (the `savedItem ? ... : ...` branch). Reference `id="1c"` in `design/new-listing.html`.

Remove the `CopyListingSection` from this screen — by this point the user has already copied. Replace with:

- A green check + "Item saved".
- A summary row: thumbnail, title, meta line (`T-Shirt · Men's XL · listed at $45.00 · paid $6.00`), status badge from `STATUS_STYLES`.
- Three figures: **potential profit** (`listPrice - purchasePrice`, green when positive), **ROI**, and **listed today** (count of items created today). Reuse `computeProfit` / `computeRoi` from `lib/analytics.ts` — do not inline the math.
- Three actions: **Create another** (primary, resets the form — the existing `handleCreateAnother`), **View item** (`/listings/{id}`, new), **All listings**.

---

## Task 8 — Verify

- `npm run lint` and `npx tsc --noEmit` clean.
- Full manual pass: upload 3 photos → analyze → edit price → confirm copy preview updates live → copy → try saving with purchase price empty (must block "Save as listed", must allow "Save as draft") → fill it → save → land on the new confirmation.
- Widths 1440 / 1024 / 768 / 390. Both color schemes.
- Confirm the analyze error path still renders (`role="alert"` with Try again / Dismiss) and that removing a photo still calls `DELETE /api/upload`.

---

## Suggested agent split

| Agent | Scope | Depends on |
|---|---|---|
| A | Task 1 (deletions) + Task 5 (schema description) + Task 6 (cost) | — |
| B | Task 2 (state lift + reorder) | A |
| C | Task 3 (responsive layout + sticky bar) | B |
| D | Task 4 (field changes) | B |
| E | Task 7 (post-save screen) | — |
| F | Task 8 (QA) | C, D, E |

A and E are independent and can run immediately. B is the critical path — C and D should not start until the state ownership decision in Task 2 is committed, or they will conflict in `ItemForm.tsx`.

---

## Out of scope

`/listings`, `/listings/[id]`, `/analytics`, bulk multi-select, and per-marketplace crosspost tracking. Do not touch them.

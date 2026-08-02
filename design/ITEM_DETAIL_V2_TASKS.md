# Item detail v2 — sequential subtask plan

Execution plan derived from `design/ITEM_DETAIL_V2.md` (the Claude Design brief) and reconciled against the actual repo. The brief's own "Build plan" assumes a parallel fan-out across disjoint files; **this document replaces it with an ordered chain of subtasks**, one agent per subtask, dispatched one at a time in order.

**Visual reference:** `design/item-detail-v2.html` (open in a browser; read the source). Screenshots: `item-detail-v2-listed.png`, `item-detail-v2-modal.png`, `item-detail-v2-sold.png`.

**Target route:** `app/listings/[id]/page.tsx`. The brief calls it `/items/:id` — that route does not exist. Everywhere the brief says `/items/:id`, read `/listings/[id]`.

---

## Repo reality check — deltas from the brief

Five things in the brief do not match the codebase. Each one changes a subtask; do not let an agent discover these mid-task.

1. **`ItemPosting` does not exist.** No such model in `prisma/schema.prisma`, and `LISTINGS_AND_DETAIL.md` is not in the repo. The brief's Task 6 (`ChannelTiles` "reads/writes `ItemPosting` rows") has no data layer under it. Crosspost tracking was explicitly listed as deferred in `design/README.md`. → Split into a schema/API subtask (**S8a**) and a UI subtask (**S8b**), and gate both on a decision (see Open questions).
2. **A mark-sold modal already exists.** `components/MarkSoldDialog.tsx` is a native `<dialog>` + `showModal()` — focus trap, Escape, and backdrop are already browser-native and already validated by `MarkSoldSchema`. It is **shared with `components/ListingsTable.tsx`**. The brief's Task 5 should extend this component, not author a new one, and any prop change has two call sites.
3. **There is no edit page.** The brief's gallery caption links to `/items/:id/edit#photos` per `EDIT_LISTING.md` — neither exists. Editing today is `components/ItemEditSection.tsx`, inline on the detail page.
4. **Delete and status changes already live in `components/ItemLifecycleSection.tsx`**, with a confirm step. The `⋯` menu is a *migration* of that component's actions, not new behavior.
5. **`lib/fees.ts` does not exist**, but `lib/analytics.ts` already exports `computeProfit` / `computeRoi`, which the sold panel and Analytics both use. Acceptance criterion "profit preview and the saved sale agree exactly with Analytics" means the modal must compute through those, not reimplement them.

---

## Ground rules — apply to every subtask

- **Read every file before editing it.** Do not infer contents.
- **No new dependencies.** Stack is Next.js App Router, Tailwind v4, Prisma, Zod, vitest.
- **Light *and* dark mode.** The reference HTML is dark-only. Translate literal hex to the existing Tailwind pairs (`border-black/15 dark:border-white/20`, `text-black/60 dark:text-white/60`). Never hardcode `#0a0a0a`.
- **Server components unless interactivity is required.**
- **The page must build and work at the end of every subtask.** No subtask may leave a dangling import or a removed section with no replacement. Where a later subtask replaces something, the earlier one leaves the old version in place.
- **New components go in `components/item/`** (mirrors the existing `components/analytics/` grouping).
- **Preserve a11y conventions already in use:** `role="alert"` on errors, `aria-pressed` on tabs, `min-h-11` tap targets.
- **Gallery images must be real `<img>` / `background-image` assignments**, never a templated `src` string (a base64 data URI inside a `style` attribute truncates at `;base64,`).
- **Verify before reporting done:** `npm run lint && npx tsc --noEmit && npm test`.
- **Scope discipline:** touch only the files your subtask names. If you believe another file must change, stop and say so.

---

## Order of work

```
S1  fee estimator (pure)            → no UI
S2  sale API + schema               → no UI
S3  page shell + sticky action bar  → layout every later task slots into
S4  gallery
S5  price / sale summary panels
S6  record-a-sale modal + toast
S7  copy panel + character counts
S8a ItemPosting schema + API        ┐ gated — see Open questions
S8b channel tiles UI                ┘
S9  mobile pass
```

S1 and S2 are pure logic and unblock S5/S6. S3 establishes the two-column shell, so it must land before any panel subtask. S4–S7 each replace one region of that shell. S8a/S8b are the only subtasks that touch the database.

---

## S1 — Fee estimator

**Depends on:** nothing.
**Files:** `lib/fees.ts` (new), `lib/fees.test.ts` (new).

Build the platform fee table and estimator:

```ts
const FEE_RULES = {
  FB_MARKETPLACE: { rate: 0,      flat: 0    },
  DEPOP:          { rate: 0.10,   flat: 0    },
  EBAY:           { rate: 0.1325, flat: 0.40 },
} as const;

export function estimateFees(platform: Platform, soldPrice: number): number
```

Round to 2dp. Use the existing `Platform` enum values from `@prisma/client` (`FB_MARKETPLACE` / `DEPOP` / `EBAY`) — **not** the brief's lowercase `facebook`/`depop`/`ebay` keys. Also export a per-platform helper-text string ("Local pickup — usually $0", "Est. 10% of sold price", "Est. 13.25% + $0.40") so S6 does not restate the rule.

**Tests** (follow the style of `lib/analytics.test.ts`): each platform's estimate at $65 and at $0; rounding at a value that would otherwise produce >2dp.

**Acceptance:** `npm test` passes; nothing imports `lib/fees.ts` yet.

---

## S2 — Sale API: edit and revert

**Depends on:** S1 (for nothing at runtime — order only).
**Files:** `lib/item-schema.ts`, `app/api/items/[id]/route.ts`.

The brief specifies a new `POST/DELETE /api/items/:id/sale` route. **Do not add one.** The repo already routes sale mutations through `PATCH /api/items/[id]` with a discriminated-union `ItemMutationSchema` (`update` | `mark_sold` | `set_status`). Extend that union instead:

1. **`mark_sold` currently succeeds on an already-SOLD item.** Reject it with 409 when `status === "SOLD"`, so the create path and the edit path stay distinct.
2. **Add an `edit_sale` action** reusing `MarkSoldSchema`, which updates the sale fields on an item that *is* already SOLD (404 if not found, 409 if not SOLD).
3. **Add a future-date guard** to `MarkSoldSchema`: `soldDate` may not be after today. Applies to both actions.
4. **Revert already works** — `set_status` to `LISTED` nulls `soldPrice`/`soldPlatform`/`soldDate`/`platformFees`. Confirm it and leave it alone; this is what Undo and "Mark as not sold" will call.

Negative profit must remain valid and persist — do not add a non-negative constraint on profit anywhere.

**Acceptance:** `mark_sold` on a SOLD item → 409. `edit_sale` on a SOLD item → 200 and fields updated. `edit_sale` on a LISTED item → 409. Future `soldDate` → 400 with a readable message. `set_status: LISTED` on a SOLD item round-trips back to LISTED with sale fields null. Existing `ListingsTable` mark-sold flow still works.

---

## S3 — Page shell + sticky action bar

**Depends on:** S2.
**Files:** `app/listings/[id]/page.tsx`, `components/item/ItemActionBar.tsx` (new).

Restructure the page around a sticky bar and two columns.

**Sticky bar** (`top-0`, translucent background + `backdrop-blur`, 1px bottom border): back link → truncating title → status pill → primary `Mark as sold` (only when not SOLD) → `Edit` → `⋯`. Status pill colors: `Listed` sky, `Sold` green — reuse `lib/status-style.ts` if it already covers this, otherwise extend it rather than inlining a second color map. Note the repo has a third status, `DRAFT`, which the brief ignores; keep it rendering sensibly.

**`⋯` menu** items: Edit item · Duplicate as new listing · Archive listing (→ "Mark as not sold" when SOLD) · **Delete item** in red behind a confirm dialog. Menu closes on outside click and on Escape. This absorbs `components/ItemLifecycleSection.tsx` — move its status-change and delete logic (including the existing confirm step and error handling) into the menu, then delete the component and its import. `Duplicate as new listing` has no backend today; render it disabled or omit it, and say which you chose.

**Two-column layout:** `display:flex; flex-wrap:wrap; gap:36px`, gallery column `flex:1 1 400px; max-width:440px`, content column `flex:1 1 560px`. This stacks below ~1030px with **no media query** — do not add one.

**Also delete:** the standalone "Edit"/"Manage" card wrappers. `ItemEditSection` stays reachable (from `Edit`), but stops being a card in the page flow.

**Leave in place, untouched, inside the content column:** the existing Pricing section, Sale section, `CopyListingSection`, Keywords, Item details, and Private notes. S5/S7 replace them. Move the photo grid into the gallery column as-is; S4 replaces it.

**Acceptance:** page renders at 1440/1024/768/390px with no horizontal scroll; bar stays pinned while the right column scrolls; menu keyboard-dismissible; delete still works and still confirms; `ItemLifecycleSection.tsx` is gone with no orphan imports.

---

## S4 — Gallery

**Depends on:** S3.
**Files:** `components/item/ItemGallery.tsx` (new), `app/listings/[id]/page.tsx` (swap the photo block for the component).

1:1 hero (`object-fit:cover`, radius 14, 1px border) above a 4-up thumbnail grid. Active thumb: 2px light border at full opacity; others at `.65`. Arrow keys move between photos. Clicking the hero opens a lightbox (Escape closes, focus returns to the hero). Caption line: `{n} photos · created {date}` on the left, a photo-management affordance on the right.

**The brief's `Edit photos → /items/:id/edit#photos` link has no destination.** Point it at whatever `Edit` opens in S3 (i.e. `ItemEditSection`) or render it as plain text — do not ship a link to a 404.

Sticky at `top:88px` on wide screens only; static once the columns stack. Handle 0 photos (existing empty state) and >4 photos (the grid is 4 columns; let it wrap).

**Acceptance:** photos load as real image elements; keyboard navigation works; lightbox traps focus and restores it; no layout shift on load; works with 1, 4, and 8 photos.

---

## S5 — Price and sale summary panels

**Depends on:** S3, S1.
**Files:** `components/item/PricePanel.tsx` (new), `components/item/SaleSummary.tsx` (new), `app/listings/[id]/page.tsx`.

`PricePanel` (LISTED/DRAFT): three figures at 30px/600 — `Listed at` · `You paid` · `Profit if it sells at list`, the third separated by a left rule. Below it, the AI reference collapsed to **one line** — `AI suggested $58.00 · range $45.00–$75.00 · high confidence` — with a `Why?` disclosure revealing `priceReasoning`. This replaces the current 200px AI block. Handle every AI field being null (render no line at all).

`SaleSummary` (SOLD): green-tinted panel, `Sold on {platform} · {date}`, three 26px figures (sold price, profit, ROI), an `Edit sale` button, the arithmetic line (`$65.00 sold − $65.00 paid − $0.00 fees`), and `No fees recorded — profit may be overstated` when fees are 0/null on a platform that charges.

**Profit color, both panels:** `>0` green, `<0` red, `==0` neutral white/foreground — **not** green — plus the note `Break-even before fees — consider relisting higher`. This is a named acceptance criterion; get the zero case right.

Profit and ROI must come from `computeProfit` / `computeRoi` in `lib/analytics.ts`. Do not reimplement the arithmetic.

Delete the old Pricing and Sale sections from `page.tsx` once these render.

**Acceptance:** all three profit tones render correctly (seed a positive, a zero, and a negative item); figures match `/analytics` for the same item; AI line collapses and expands; panel is correct when every optional field is null.

---

## S6 — Record-a-sale modal

**Depends on:** S5, S2, S1.
**Files:** `components/MarkSoldDialog.tsx` (extend), `components/item/SaleToast.tsx` (new), `app/listings/[id]/page.tsx`, `components/ItemSellSection.tsx` (delete).

**Extend the existing dialog — do not write a new modal.** It already gives you `<dialog>` + `showModal()` (focus trap, Escape, backdrop), `MarkSoldSchema` validation, and the PATCH call. It is also rendered by `components/ListingsTable.tsx`; keep that call site working, adding new props as optional.

Add, per the brief:

- **Segmented platform buttons** (Facebook / Depop / eBay / Other) replacing the `<select>`. Selecting one auto-fills the fee estimate via `estimateFees` from S1. *"Other" has no `Platform` enum value* — either omit it or map it, and say which.
- **Sold price** prefilled with list price, `$` prefix, 19px/600. Editing it recomputes the fee estimate.
- **Fees** auto-estimated, with helper text stating the rule being applied. Once the user types in the field it is "touched" and must never be auto-overwritten again.
- **Sold date**: `Today` / `Yesterday` chips plus the native date input. Defaults to today, local calendar date (the existing `localDate()` helper already does this correctly — keep it).
- **Live profit preview**: profit at 28px (green/neutral/red), ROI, and the arithmetic in mono. One contextual warning, in this priority order: price is 0 (muted) → profit < 0 (red) → profit == 0 (amber, break-even) → platform takes a cut but fees are $0 (amber).
- **Money inputs accept `65`, `65.00`, `$65`** and strip non-numerics on blur.
- **`mode: 'create' | 'edit'`** — edit mode is titled `Edit sale details`, prefills from the recorded sale, CTA `Save changes`, footnote `Updates this item's profit everywhere it appears.`, and calls the `edit_sale` action from S2.
- **`overflow:hidden` on body while open.**

**On save:** modal closes, page flips to the sold state, and a **toast with Undo** appears for 7s reading `Marked as sold · $65.00 · profit $0.00`. Undo calls `set_status: LISTED`, which restores `listed` and clears the sale.

**Delete `components/ItemSellSection.tsx`** — the inline expanding form it renders is exactly what the redesign removes ("nothing expands inline on the page"). Remove its import from `page.tsx`.

**Acceptance:** every checklist item in the brief that mentions the modal. Specifically: fee estimate follows platform *and* price until the user edits fees, then stops; Escape and backdrop close; focus is trapped and returns to the trigger; Undo fully reverts; edit mode round-trips; `ListingsTable`'s mark-sold still works unchanged.

---

## S7 — Copy panel with character counts

**Depends on:** S3.
**Files:** `lib/listing-text.ts`, `components/CopyListingSection.tsx`, `app/listings/[id]/page.tsx`.

Rebuild the copy card as the brief's "Copy & paste": platform tabs, separate **title** and **description** blocks each with its own header row, per-platform character counts, and the `Price to enter: $65.00` reminder.

**Character limits** — `lib/listing-text.ts` currently defines only `EBAY_TITLE_MAX_LENGTH = 80`. Add Facebook 100 and Depop 65 as a `TITLE_LIMITS` record keyed by platform, and drive both the counter and the existing `truncateTitle` call from it. Counter turns red (`text-red-...`) past the limit.

Copy buttons swap to `✓ Copied` for ~1.6s — `useListingCopy` already implements this at 2000ms; reuse it rather than adding a second timer. Description keeps `white-space: pre-line`.

`CopyListingSection` is also rendered by `app/new/page.tsx`. Keep that call site working; new behavior goes behind optional props or is safe by default.

**Acceptance:** counts turn red past 100 (Facebook) / 65 (Depop) / 80 (eBay); copy buttons confirm and reset; `/new` is visually unchanged or better, and still functional.

---

## S8a — `ItemPosting` schema and API  *(gated — see Open questions)*

**Depends on:** S7.
**Files:** `prisma/schema.prisma`, a new migration, `lib/item-schema.ts`, `app/api/items/[id]/postings/route.ts` (new).

The only subtask that touches the database. Add a model recording one row per (item, platform) posting with a posted-at timestamp, a unique constraint on the pair, and a cascade delete from `Item`. Expose create/list; surface it on `ItemDto` (or a sibling DTO) so the page can render posted state server-side.

`design/README.md` currently lists per-marketplace crosspost tracking as **deliberately deferred**, and both prior briefs were run under a "no changes to `prisma/schema.prisma`" constraint. Confirm before dispatching.

**Acceptance:** migration applies cleanly; posting twice for the same platform is idempotent, not an error; deleting an item removes its postings.

---

## S8b — Channel tiles  *(gated on S8a)*

**Depends on:** S8a.
**Files:** `components/item/ChannelTiles.tsx` (new), `app/listings/[id]/page.tsx`.

Three tiles — posted / not posted per platform — with `Copy & mark posted`, which in **one click** does `navigator.clipboard.writeText(title + '\n\n' + body)` *and* records the posting, then flips to `Posted {date}` / `Copy again`. Header shows `{n} of 3 marketplaces`.

Clipboard write and the POST must both be handled: if the clipboard is blocked (the existing `useListingCopy` failure path), do not silently record a posting the user never made.

**Acceptance:** one click both copies and records; state survives a reload; clipboard failure does not create a phantom posting.

---

## S9 — Mobile pass

**Depends on:** all preceding.
**Files:** whatever the audit turns up; expect `components/item/*` and `app/listings/[id]/page.tsx`.

Single column (already automatic from S3's flex-wrap — verify, do not add media queries unless a specific element needs one). The action bar keeps `Mark as sold` and collapses `Edit` into `⋯`. The modal becomes a bottom sheet: full width, rounded top, slides up, profit preview pinned above the buttons. Channel tiles go 1-up. All hit targets ≥44px (`min-h-11`).

**Acceptance:** no horizontal scroll at 375px on the listed, sold, and modal-open states, in both color schemes.

---

## Open questions — resolve before dispatching

1. **Crosspost tracking (S8a/S8b): in or out?** It needs a schema change that both prior briefs forbade and that `design/README.md` records as deferred. Out is the safe default; S1–S7 + S9 are a complete, coherent redesign without it, and the copy panel still gets the user to each marketplace.
2. **"Other" platform in the sale modal.** `Platform` is a three-value Prisma enum. Adding `OTHER` is a migration; omitting it drops a button from the reference. Recommend omitting for now.
3. **`Duplicate as new listing`** in the `⋯` menu has no backend. Disable it, or cut it from the menu?
4. **Shipping cost, buyer/order notes, relist history** — the brief's own open questions 1, 4, 5. All are schema changes. Recommend deferring all three; none is required by the acceptance checklist.
5. **Editable fee rates in Settings** (brief's open question 2). There is no settings surface. Defer.

# Listing flow v3 — sequential subtask plan

Covers the whole life of an item: **create (`/new`) → find (`/listings`) → view (`/listings/[id]`) → edit (`/listings/[id]/edit`) → sell**. Written to be executed by one agent per subtask, dispatched **one at a time in order** — same convention as `design/ITEM_DETAIL_V2_TASKS.md`.

Scope decisions already made, do not re-litigate:

- **Prisma migrations are allowed.** This plan adds one model and three columns.
- **Phone and desktop are equal priorities.** Every UI subtask states both layouts.
- **All four flow areas are in scope** — create, find/manage, detail↔edit, and sale recording.

There is no separate visual reference for this plan. Match the language already established by `design/home.html`, `design/new-listing.html`, and the shipped `components/item/*` — 12–14px radii, `border-black/15 dark:border-white/20`, `text-black/60 dark:text-white/60`, `min-h-11` tap targets.

---

## Repo reality check — read before dispatching anything

Verified against the tree at `1ddc233`. Every item here has bitten, or will bite, an agent that assumes otherwise.

1. **`item.description` is not the text you paste anywhere.** `formatListingText` in `lib/listing-text.ts` builds every marketplace body from `item.summary` + condition + size (+ pickup line for Facebook, + hashtags for Depop). It never reads `description`. But **neither `/new` nor the edit page exposes a `summary` field** — `components/ItemForm.tsx` dropped it (per `NEW_LISTING_REDESIGN.md` Task 1.4) and `components/item/EditListingForm.tsx` never had one, while `lib/item-edit-draft.ts` silently round-trips it. Net effect: the user edits "Description", which only ever renders on the detail page, and cannot edit the copy that actually goes to Facebook/Depop/eBay. **S2 fixes this and everything else assumes it is fixed.**
2. **Two divergent photo components.** `components/PhotoUploader.tsx` (used only by `/new`) can add and remove; it labels the first photo "Cover" but has **no reorder and no set-cover**. `components/item/PhotoManager.tsx` (used only by the edit page) has drag reorder, keyboard reorder, set-cover, remove-with-undo, and per-tile retry. S11 collapses them.
3. **`components/ItemEditSection.tsx` is dead.** Nothing imports it. It is a leftover from the pre-edit-page era.
4. **`app/new/page.tsx` contains two unreachable blocks.** The function returns early at line ~299 when `!savedItem`, so in the second `return` the `savedItem ? … : …` ternary can never take its else branch — lines ~652–706 are a whole second copy of the uploader/analyze/form that is never rendered. Lines ~519–549 are a `<div className="hidden">` duplicate of the header and step indicator. Both are dead.
5. **Sort is inconsistent between the two `/listings` views.** `lib/listing-sort.ts` `parseSort` understands `field-dir` tokens (`days-desc`) *and* four legacy aliases (`newest`, `oldest`, `price-high`, `price-low`). `components/ListingsTable.tsx` writes tokens; `components/ListingsFilterBar.tsx` only renders its Sort `<select>` in grid view and only understands the legacy aliases; `app/listings/page.tsx` normalizes with `isSortValue()` for the select but sorts with the raw token. Sort the table by "Days listed", switch to Cards → the grid *is* sorted by days but the select reads "Newest first", and "Clear filters" does not appear. `lib/dashboard.ts:154` already carries a comment documenting this workaround. Fix in S3; do not paper over it again.
6. **`/listings` has no pagination.** `prisma.item.findMany({ where })` with no `take`/`skip`, plus `prisma.item.count()` unfiltered for the "N of M" line. Every row and every 1600px cover JPEG loads on every request. Sorting is deliberately in-memory (computed columns) — keep it that way, but bound the query.
7. **Cards and table are not at feature parity.** The table has status change, mark-sold, and relist per row. The grid — which is the **default view** — has none, and omits days-listed and profit.
8. **`AppHeader` renders `hidden lg:block` on `/new`.** On a phone there is no nav on the create screen at all: no Home, no Listings, no way out except browser back. See `components/AppHeader.tsx:29`.
9. **`/new` state is client-only.** A reload after analysis loses the analysis (which cost real money — the page shows you the price) and orphans the uploaded photos in Supabase storage forever. There is no resume.
10. **Only the detail page shows a sale undo toast.** `components/item/ItemSaleController.tsx` wires `SaleToast` + `set_status` revert; the same `MarkSoldDialog` fired from `components/ListingsTable.tsx` gives no undo.
11. **The detail page's back link is hardcoded `/listings`**, dropping `status`/`q`/`sort`/`view`. Filter context is lost on every item you open.
12. **`next/image` is not in use anywhere** and `next.config.ts` is empty — no `remotePatterns`, so switching is a config change too. Uploads are already client-compressed to ≤1600px JPEG by `lib/compress.ts`.
13. **`/api/analyze` has no rate limit.** Only login does (`lib/rate-limit.ts`, `LoginAttempt`). Out of scope here, noted so nobody assumes there is one.
14. **`ItemStatus` is `DRAFT | LISTED | SOLD`** and `Platform` is `FB_MARKETPLACE | DEPOP | EBAY`. Several docs and the reference HTML imply an "Other" platform — it does not exist.

---

## Ground rules — apply to every subtask

- **Read every file before editing it.** Do not infer contents. This repo's Next.js version has breaking changes from training data (`AGENTS.md`); consult `node_modules/next/dist/docs/` before using an App Router API you have not verified here.
- **No new dependencies.** Stack is Next.js 16 App Router, React 19, Tailwind v4, Prisma 6, Zod 4, vitest.
- **The app must build and work at the end of every subtask.** No dangling imports, no region removed without a replacement. Where a later subtask replaces something, the earlier one leaves the old version rendering.
- **Light *and* dark mode**, using the existing Tailwind pairs. Never hardcode hex.
- **Server components unless interactivity is required.**
- **New item components go in `components/item/`; new listings-page components in `components/listings/`** (new directory, mirroring `components/analytics/`).
- **Pure logic goes in `lib/` with a colocated `*.test.ts`.** Follow `lib/analytics.test.ts` for style. Anything with arithmetic or parsing gets tests.
- **Never reimplement profit/ROI.** `computeProfit` / `computeRoi` from `lib/analytics.ts`, always.
- **Preserve the a11y conventions in use:** `role="alert"` on errors, `aria-live="polite"` on async status, `aria-pressed` on toggle buttons, `min-h-11` tap targets, `aria-sort` on sortable headers.
- **Money inputs keep `onWheel={(e) => e.currentTarget.blur()}`.**
- **Verify before reporting done:** `npm run lint && npx tsc --noEmit && npm test`.
- **Scope discipline:** touch only the files your subtask names. If another file must change, stop and say so.

---

## Order of work

```
PHASE 0 — correctness, no new surface
  S1   delete dead code
  S2   fix the summary/description content model        ← headline bug
  S3   unify sort tokens across both listing views

PHASE 1 — never lose the user's place
  S4   preserve list context in links (back + prev/next)
  S5   loading states + mobile nav on /new

PHASE 2 — /listings becomes a work surface
  S6   bounded query + pagination
  S7   status chips with counts + attention filters
  S8   card/table action parity
  S9   bulk multi-select + bulk actions
  S10  one shared undo toast

PHASE 3 — creation flow
  S11  one photo component everywhere
  S12  server-persisted drafts (resume /new)            ← migration
  S13  manual entry, no AI
  S14  duplicate as new listing

PHASE 4 — crosspost tracking                            ← migration
  S15  ItemPosting model + API
  S16  channel tiles on the detail page
  S17  posted state in /listings

PHASE 5 — edit ergonomics
  S18  inline quick-edit from the detail page
  S19  re-run AI from the edit page
  S20  replace window.confirm with a real dialog

PHASE 6 — sales
  S21  shipping cost + net profit                       ← migration
  S22  record a sale from anywhere

PHASE 7 — performance
  S23  next/image pipeline
  S24  orphaned-upload sweep
```

**Critical path:** S2 → S11 → S12. S2 changes what a listing *is*, S11 changes what the photo editor *is*, and S12 restructures how `/new` persists. Anything touching `ItemForm`, `PhotoUploader`, or `app/new/page.tsx` must wait behind them.

Phases 0–2 are independently shippable and deliver most of the daily-use improvement. Phase 4 is the largest single feature and the one that makes this app a crossposting tool rather than a text generator.

---

# PHASE 0 — Correctness

## S1 — Delete dead code

**Depends on:** nothing.
**Files:** `components/ItemEditSection.tsx` (delete), `app/new/page.tsx`.

1. Delete `components/ItemEditSection.tsx`. Confirm with a repo-wide search that nothing imports it (nothing does today) before deleting.
2. In `app/new/page.tsx`, remove the unreachable `savedItem ? … : …` else branch in the second `return` and the `<div className="hidden">` duplicate header block. After this, the second `return` renders the saved-confirmation card unconditionally, because the function already returned for the `!savedItem` case.
3. Do not change any behaviour. This is deletion only.

**Acceptance:** `npm run lint && npx tsc --noEmit && npm test` clean. `/new` behaves identically before and after: upload → analyze → save → confirmation card. The file is roughly 200 lines shorter.

---

## S2 — Fix the summary/description content model

**Depends on:** S1.
**Files:** `lib/listing-text.ts`, `lib/item-draft.ts`, `components/ItemForm.tsx`, `components/item/EditListingForm.tsx`, `app/listings/[id]/page.tsx`, `lib/listing-text.test.ts` (new).

Today `summary` drives every marketplace body and is uneditable; `description` is editable and goes nowhere but the detail page. That is backwards. Fix it by making **one field the listing body**, editable, previewed live.

Pick **option A** unless you find a blocker, and say which you shipped:

- **(A) Promote `description` to the listing body — recommended.** `formatMarketplace` uses `description` as its opening block instead of `summary`. `summary` stays in the schema and stays populated by the AI, but becomes a *fallback only*: use it when `description` is empty. Rationale: `description` is the field both editors already expose, both users already believe is the listing text, and it is `NOT NULL` in the schema. No migration.
- **(B) Expose `summary` as a first-class field.** Add a labelled "Listing body (what gets pasted)" textarea to both `ItemForm` and `EditListingForm`, and relabel `description` as "Long description (detail page only)". Honest, but keeps two overlapping text fields the user must understand.

Whichever is chosen:

1. **The copy preview must be live in both editors.** `/new` already achieves this via `buildDraftItemDto` → `ControlledCopyListingSection`. The **edit page has no copy preview at all** — add one: render `CopyListingSection` (or the controlled variant) in `EditListingForm`'s right column, fed from the live draft fields, so editing the body updates the pasteable text without saving. Build the preview `ItemDto` with a helper in `lib/item-edit-draft.ts` mirroring `buildDraftItemDto`; do not inline an object literal.
2. **Relabel in the UI** so the mapping is unambiguous: the field that feeds the marketplaces is labelled as such, with a one-line helper (`This is the text copied to Facebook, Depop and eBay.`).
3. **The detail page's "Listing content" section** must render whichever field is now authoritative, and must not display the same text twice.
4. **Tests:** `lib/listing-text.test.ts` — for each of the three platforms, assert the body is built from the authoritative field; assert the fallback path when it is empty; assert the Facebook pickup line and Depop hashtag cap of 5 still hold.

**Acceptance:** Editing the listing body on `/listings/[id]/edit` changes the copy preview on the same screen, and after save the detail page's Copy & paste block shows the edited text. An item created through `/new` produces identical copy text before and after this change (no regression for the AI-supplied default).

---

## S3 — Unify sort tokens across both listing views

**Depends on:** nothing (parallel-safe with S1/S2, but dispatch in order).
**Files:** `lib/listing-sort.ts`, `components/ListingsFilterBar.tsx`, `components/ListingsViewToggle.tsx`, `app/listings/page.tsx`, `lib/dashboard.ts`, `lib/listing-sort.test.ts` (new).

One sort vocabulary, honoured by both views.

1. **`field-dir` tokens become the only vocabulary.** Keep the legacy aliases parsing in `parseSort` for old bookmarks, but stop *emitting* them anywhere.
2. **Add `SORT_OPTIONS`** to `lib/listing-sort.ts`: an ordered array of `{ token: SortToken; label: string }` covering added↕, price↕, days↕, title↕, status, sold price, sold date. This is the single source of truth for the select.
3. **`ListingsFilterBar` renders the Sort select in both views**, driven by `SORT_OPTIONS` and by `serializeSort(parseSort(raw))` — so a token set by the table's header click displays correctly in the select, and vice versa. Remove the `view === "grid"` guard.
4. **`app/listings/page.tsx`** drops `isSortValue`/`SortValue` entirely and passes the normalized token string down. `hasActiveFilters` compares against `serializeSort(DEFAULT_SORT)`.
5. **`ListingsViewToggle`** must carry the normalized token, not the raw param.
6. **`lib/dashboard.ts:156`** currently emits `sort=oldest` with a comment explaining the workaround. Change it to `sort=added-asc` and delete the comment.
7. **Tests:** round-trip every entry in `SORT_OPTIONS` through `serializeSort`/`parseSort`; assert each legacy alias maps to the expected token; assert an unknown token falls back to `DEFAULT_SORT`.

**Acceptance:** Sort the table by Days listed descending, switch to Cards — the select reads "Days listed (longest first)", the grid is in that order, and "Clear filters" is offered. The homepage "Consider a price drop" link lands on `/listings` correctly sorted.

---

# PHASE 1 — Never lose the user's place

## S4 — Preserve list context in links

**Depends on:** S3.
**Files:** `lib/listing-context.ts` (new) + test, `app/listings/page.tsx`, `components/ListingsTable.tsx`, `app/listings/[id]/page.tsx`, `components/item/ItemActionBar.tsx`, `components/item/EditListingForm.tsx`, `components/item/ListingSavedToast.tsx`.

Opening an item currently discards the filters you used to find it, and there is no way to step to the next item without going back.

1. **`lib/listing-context.ts`** exports `buildListingsHref(params)` and `parseListingContext(searchParams)` — serialize `status`/`q`/`sort`/`view` into a compact query the detail and edit routes can carry and hand back. Pure, tested.
2. **Every link into an item** (grid card, table title link, table row click) appends the current listing query, e.g. `/listings/{id}?from=status%3DLISTED%26sort%3Ddays-desc`. Keep it to one param so the URL stays readable.
3. **`ItemActionBar`'s back link** resolves to `buildListingsHref(parsed)` when `from` is present, falling back to `/listings`. Same for `EditListingForm`'s "Back to item" — it must preserve `from` through to the detail page.
4. **`ListingSavedToast`'s `router.replace`** currently drops every param when it clears `?saved=1`. It must preserve `from`.
5. **Prev/next item navigation.** The detail page, when `from` is present, re-runs the same filter+sort in `app/listings/[id]/page.tsx` to resolve the neighbouring ids, and renders `←`/`→` controls in `ItemActionBar` with the position (`4 of 27`). Reuse `sortItems` — do not write a second ordering. Query only `{ id: true }` for this; do not load full rows twice. If the item is not in the filtered set (e.g. you just marked it sold and the filter is `status=LISTED`), render the controls disabled rather than hiding them, so the bar does not reflow.
6. Bind `[` / `]` to prev/next on the detail page. Ignore the binding while focus is in an input, textarea, select, or contenteditable.

**Acceptance:** Filter to `status=LISTED&sort=days-desc`, open the 4th item, press `]` twice, click back — you land on the same filtered, sorted list. No `from` param leaks into a saved bookmark of `/listings` itself.

---

## S5 — Loading states and mobile nav on `/new`

**Depends on:** S4.
**Files:** `app/listings/loading.tsx` (new), `app/listings/[id]/loading.tsx` (new), `app/listings/[id]/edit/loading.tsx` (new), `components/AppHeader.tsx`, `app/new/page.tsx`.

1. **Three `loading.tsx` files**, matching the shape of `app/analytics/loading.tsx`. All three routes are `force-dynamic`, so every filter change, every item open, and every edit-page entry is a blocking round trip with zero feedback today. The listings skeleton must render the correct shape for both `view=grid` and `view=table` — read the `view` param, or render a neutral skeleton that suits both, and say which you chose.
2. **`ListingsFilterBar`** shows a pending indicator while a navigation is in flight (`useTransition` around the `router.replace`, or `useLinkStatus` if this Next version exposes it — verify in `node_modules/next/dist/docs/` first). The search input must never lose typed characters to the in-flight echo; the `navigatedQRef` guard that already exists handles this — keep it.
3. **`/new` gets nav on phones.** Remove the `pathname === "/new" ? "hidden lg:block" : ""` special case in `AppHeader`. If the full header is too tall next to the sticky bottom action bar, render a reduced variant on `/new` below `lg` — a back affordance and the wordmark, nothing else — but there must always be a way off the screen that is not the browser back button. Verify at 390px that the header, the content, and the sticky bottom bar do not overlap, and that `pb-32` on the main element still clears the bar.

**Acceptance:** Typing in the listings search shows a pending state and never drops characters. All three routes show a skeleton on slow navigation. At 390px, `/new` has working navigation in all three states (pre-upload, post-analysis, post-save).

---

# PHASE 2 — `/listings` as a work surface

## S6 — Bounded query and pagination

**Depends on:** S3.
**Files:** `app/listings/page.tsx`, `components/listings/ListingsPagination.tsx` (new), `lib/listing-page.ts` (new) + test.

Sorting must stay in memory (`daysListed` and profit cannot be expressed in `orderBy`), so page in memory too but stop loading every column of every row.

1. **`lib/listing-page.ts`** exports `PAGE_SIZE = 48`, `parsePage(raw)`, and `paginate(items, page)` returning `{ items, page, pageCount, total }`. Clamp out-of-range pages to the last page rather than rendering empty. Pure, tested.
2. **`app/listings/page.tsx`**: replace the bare `findMany({ where })` with a `select` naming only the fields the two views actually render — the grid card, the table row, and the sort comparators. `description`, `priceReasoning`, `conditionNotes`, and `notes` are never rendered in a list; do not fetch them. If `toItemDtos` requires a full `Item`, add a narrower `toListingRowDto` in `lib/item-dto.ts` with its own type rather than widening `ItemDto`.
3. **Replace the unfiltered `prisma.item.count()`** with a filtered count plus a separate total, so the header reads `Showing 1–48 of 213 · 213 items total` honestly.
4. **`ListingsPagination`** — a server component of prev/next/numbered links preserving every existing param. `min-h-11` targets; on phones collapse to `‹ Page 2 of 5 ›`.
5. **Guard the ceiling.** If the filtered set exceeds 2000 rows, cap the in-memory sort input and surface a one-line note that the view is truncated. Do not silently mis-sort.

**Acceptance:** With 200+ seeded items, `/listings` renders one page of 48 and paginates without losing filters or sort. Confirm via the network panel that the payload no longer includes description text. Sorting still orders across the *whole* filtered set, not just the visible page.

---

## S7 — Status chips with counts and attention filters

**Depends on:** S6.
**Files:** `components/ListingsFilterBar.tsx`, `app/listings/page.tsx`, `lib/listing-filters.ts` (new) + test.

1. **Replace the status `<select>` with segmented chips**: `All · Drafts · Listed · Sold`, each showing its count, `aria-pressed`, `min-h-11`, horizontally scrollable below `sm` with no page overflow. Counts come from one `prisma.item.groupBy({ by: ["status"], _count: true })` — one extra cheap query, not three.
2. **Add attention filters** matching the thresholds already in `lib/dashboard.ts:buildAttention`: `Aging (45d+)`, `Stale drafts (7d+)`, `Missing fees`. Move those predicates into `lib/listing-filters.ts` and have **both** `lib/dashboard.ts` and the listings page import them, so the homepage card and the list can never disagree. Tested.
3. `daysListed`-based filters are computed post-fetch (same reason as sorting); status and text filters stay in the `where`.
4. The homepage attention cards link to these filters (`/listings?attention=aging`) instead of approximating with `status` + `sort`.
5. Keep search as a text input with the existing 300ms debounce. Add `Clear` inside the field.

**Acceptance:** Chips show live counts and survive pagination. Clicking "Aging (45d+)" on the homepage lands on exactly the set the card counted. `lib/dashboard.test.ts` still passes.

---

## S8 — Card and table action parity

**Depends on:** S7.
**Files:** `components/listings/ListingCard.tsx` (new, extracted from `app/listings/page.tsx`), `components/listings/ListingRowActions.tsx` (new), `components/ListingsTable.tsx`, `app/listings/page.tsx`.

The grid is the default view and has no actions at all.

1. **Extract `ListingCard`** out of `app/listings/page.tsx` into its own component.
2. **`ListingRowActions`** — one client component owning status change, mark-sold, and relist, used by **both** the card and the table row. This removes the duplicated `changeStatus` fetch logic currently inside `ListingsTable`.
3. **On the card**: a compact action row — `Mark sold` primary, `⋯` for status change / edit / duplicate (S14) / delete. On desktop, reveal on hover *and* on focus-within; on phones, always visible. The card's outer element is a `<Link>` today — actions must not be nested inside it (invalid HTML, and taps fall through). Restructure so the link covers the media and title only, or use an overlay link pattern with the actions above it in stacking order.
4. **Add `Days listed` and `Profit if sold at list`** to the card, using `daysListed` and `computeProfit`. Tone from `lib/profit-tone.ts`.
5. **Table**: keep the existing columns; move the per-row controls into `ListingRowActions` so both surfaces stay in step. Keep `event.stopPropagation()` on the actions cell so a row click does not navigate.

**Acceptance:** Every action available on a table row is available on a card. Marking sold from a card refreshes in place. No nested interactive elements (verify with the a11y tab of devtools). Keyboard: Tab reaches every card action.

---

## S9 — Bulk multi-select and bulk actions

**Depends on:** S8.
**Files:** `components/listings/ListingsSelectionProvider.tsx` (new), `components/listings/BulkActionBar.tsx` (new), `components/ListingsTable.tsx`, `components/listings/ListingCard.tsx`, `app/api/items/bulk/route.ts` (new), `lib/item-schema.ts`.

1. **Selection state** in a context provider scoped to the listings page. Checkbox on each card (top-left, over the image) and a leading checkbox column in the table, plus a header select-all that selects the **current page only** — with an explicit "Select all N matching filters" affordance if you want the wider set. Shift-click range select in the table.
2. **`BulkActionBar`** — fixed bottom bar when the selection is non-empty: `N selected · Set status ▾ · Delete · Clear`. Same visual treatment as the existing edit-page dirty bar (`EditListingForm`, translucent + `backdrop-blur` + top border + `pb-[max(0.75rem,env(safe-area-inset-bottom))]`).
3. **`POST /api/items/bulk`** with a Zod discriminated union mirroring `ItemMutationSchema`'s style: `{ action: "set_status", ids, data }` and `{ action: "delete", ids }`. Cap `ids` at 200. Auth-gated like every other route. Status changes run in one `updateMany`; **delete must reuse the existing per-item photo-cleanup path** from `app/api/items/[id]/route.ts` — extract that cleanup into a shared helper rather than duplicating it, and keep its "row is authoritative, storage orphan is acceptable" semantics.
4. **Bulk delete requires confirmation** naming the count, in the same native `<dialog>` pattern as `ItemActionBar`'s delete. Bulk delete does **not** get an undo — say so in the dialog.
5. Bulk status change **does** get an undo toast via S10.
6. Selection clears on filter change, page change, and after a successful bulk action.

**Acceptance:** Select 10 across a page, set them to DRAFT, undo, and confirm all 10 return to LISTED. Bulk-delete 3 items and confirm their photos are gone from storage. `ids` of 500 → 400 with a readable message.

---

## S10 — One shared undo toast

**Depends on:** S9.
**Files:** `components/UndoToast.tsx` (new, promoted from `components/item/SaleToast.tsx`), `components/item/ItemSaleController.tsx`, `components/ListingsTable.tsx`, `components/listings/ListingRowActions.tsx`, `components/listings/BulkActionBar.tsx`, `components/item/PhotoManager.tsx`.

Four surfaces roll their own toast today (`SaleToast`, `ListingSavedToast`, `PhotoManager`'s inline toast, `ItemSaleController`'s error banner), with three different timeouts (7000 / 6000 / 4000ms) and three different positions.

1. **Generalize `SaleToast` into `UndoToast`**: `{ message, onUndo?, onDismiss, isUndoing?, timeoutMs? }`. One position, one z-index, one dismiss affordance, `role="status"`, timers cleared on unmount. Default 7s when undoable, 4s when not.
2. **Wire it into the mark-sold path from the table and the cards**, which have no undo today — the revert is the same `set_status: LISTED` call `ItemSaleController` already makes, which nulls the sale fields.
3. Migrate `PhotoManager` and `ItemSaleController` onto it. Leave `ListingSavedToast` as a thin wrapper if its `router.replace` cleanup makes it awkward, but it must use the same visual component.
4. Two toasts must never stack on top of each other — the newest replaces the current one.

**Acceptance:** Mark sold from a card, from a table row, and from the detail page — all three offer undo, all three revert fully. Remove a photo in the edit page and undo — same visual language.

---

# PHASE 3 — Creation flow

## S11 — One photo component everywhere

**Depends on:** S2.
**Files:** `components/item/PhotoManager.tsx`, `components/PhotoUploader.tsx` (delete), `app/new/page.tsx`, `lib/item-draft.ts`.

`/new` cannot reorder photos or choose a cover, yet it tells the user the first photo is the cover. The edit page can do all of it. Delete the weaker one.

1. **Make `PhotoManager` usable without an item draft.** It currently takes `photos: DraftPhoto[]` plus eight callbacks from `useItemDraft`. Add a small `usePhotoCollection(initialUrls)` hook in `lib/` that provides the same surface for the create flow, or generalize `useItemDraft` so `/new` can use it with an empty item. Pick one and state it; do not fork the component.
2. **`/new` renders `PhotoManager`.** It gains drag reorder, keyboard reorder (arrows/Enter/Delete), set-cover, remove-with-undo, and per-tile retry — all of which already work on the edit page.
3. **Photo order becomes the saved order.** `buildCreateItemInput` already sends `draft.photos`; make sure the reordered array flows through and that `CreateItemSchema`'s duplicate check still holds.
4. **Delete `components/PhotoUploader.tsx`** once nothing imports it.
5. Verify the `/new`-specific behaviours survive: changing the photo set clears the existing analysis (`handleUploadedUrlsChange` today resets analysis/draft/usage), and removing an uploaded photo still `DELETE`s it from `/api/upload`.

**Acceptance:** On `/new`, add four photos, drag the third to first, confirm it is labelled Cover, save, and confirm the detail page hero is that photo. Keyboard-only reorder works. Removing a photo before saving deletes it from storage.

---

## S12 — Server-persisted drafts (resume `/new`)  *(migration)*

**Depends on:** S11.
**Files:** `prisma/schema.prisma` + migration, `app/new/page.tsx`, `app/api/items/route.ts`, `app/api/items/[id]/route.ts`, `lib/item-schema.ts`, `lib/item-draft.ts`.

Today a reload after analysis destroys a paid AI result and orphans the uploads. Fix it by making the draft a real row.

**Approach — persist on analysis:**

1. When `/api/analyze` returns successfully, `/new` immediately `POST`s the draft to `/api/items` with `status: "DRAFT"`, and from then on the page is editing a real row via `PATCH`. The user's subsequent edits autosave (debounced ~1.5s, one in-flight request at a time, last-write-wins) and "Save as listed" becomes a `set_status` call.
2. **`CreateItemSchema` must tolerate an incomplete draft.** It currently requires `category` non-empty, `listPrice > 0`, and a valid `purchasePrice`. Add a **draft-relaxed variant** — `DraftItemSchema` — where those are optional/zero-tolerant, and keep the strict schema as the gate for the `DRAFT → LISTED` transition. Do **not** loosen `CreateItemSchema` itself: `set_status` to `LISTED` must still refuse an item that would break analytics, and it must return a field-level error the page can map onto the form.
3. **Schema change:** add `Item.draftStep String?` (or an enum-like text column) recording how far the draft got — `photos` / `analyzed` / `reviewed` — so `/new` can resume into the right state, plus `@@index([status, updatedAt])` to support the drafts list. Keep it additive and nullable; existing rows are unaffected.
4. **Resume UX:** `/new` with no query starts fresh. `/new?draft={id}` resumes. When at least one DRAFT exists, `/new` shows a dismissible "Resume your last draft — {title}, {n} photos, saved {relative time}" banner above the uploader. `/listings?status=DRAFT` rows link to `/new?draft={id}` rather than the edit page when `draftStep` is set.
5. **Autosave status** must be visible and honest — reuse the language already in `EditListingForm`'s header (`Unsaved changes` / `All changes saved`), and never claim saved while a request is in flight.
6. **Abandoned drafts are already handled**: `lib/dashboard.ts:buildAttention` surfaces "N drafts never published" past 7 days, and S7 gives it a real filter. Do not add a separate cleanup job.

**Acceptance:** Analyze photos, hard-reload the page, and resume with the analysis, the photos, and every edited field intact. Kill the tab mid-flow and confirm no photo is orphaned in storage. Attempting "Save as listed" with an empty purchase price still blocks, with the error on the field.

---

## S13 — Manual entry, no AI

**Depends on:** S12.
**Files:** `app/new/page.tsx`, `lib/item-draft.ts`, `components/ItemForm.tsx`.

For an item you already know, paying for and waiting on an analysis is pure friction.

1. Add **"Enter details manually"** next to "Analyze photos" — it skips analysis and opens `ItemForm` with an empty draft. Photos are still required by `CreateItemSchema`.
2. `createItemDraft` gains a sibling `createEmptyItemDraft(photoUrls)`. Everything AI-derived (`suggestedPrice`, `priceLow`, `priceHigh`, `priceReasoning`, `aiConfidence`, `aiCondition`) is null/absent, and every UI element that renders those must already handle null — **`ItemForm` currently does not**: it renders `money.format(draft.suggestedPrice)` and the "AI read this as…" helper unconditionally. Make those blocks conditional.
3. **"Analyze photos" stays available** after manual entry begins, and running it must not silently overwrite fields the user has typed. Offer it as a merge: fill only the empty fields, or show what changed. Simplest acceptable behaviour is to disable analysis once a manual draft has edits, with a tooltip saying why — pick one and state it.
4. The step indicator adapts: `Photos › Details › Post & save` when analysis is skipped.

**Acceptance:** Create a complete listing from photos with no analysis call (verify no request to `/api/analyze` in the network panel). The saved item renders correctly on the detail page with every AI block absent, not blank-labelled.

---

## S14 — Duplicate as new listing

**Depends on:** S12.
**Files:** `components/item/ItemActionBar.tsx`, `app/api/items/[id]/duplicate/route.ts` (new), `lib/item-schema.ts`, `components/listings/ListingRowActions.tsx`.

`ItemActionBar` already renders a **disabled** "Duplicate as new listing" menu item with a `title` explaining it does not exist. Make it real.

1. **`POST /api/items/[id]/duplicate`** copies content, attributes, keywords, pricing, and AI reference fields into a new `DRAFT`. It must **not** copy sale fields, `createdAt`, or `updatedAt`.
2. **Photos are shared by reference, not re-uploaded** — the new row points at the same storage URLs. This has a consequence the existing delete path already anticipates: `app/api/items/[id]/route.ts` checks `prisma.item.count({ where: { photos: { has: photoUrl } } })` before deleting an object. **`DELETE /api/items/[id]` does not do that check** — it deletes every photo unconditionally. Fix it in this subtask to use the same reference check, or duplication will let one delete break another item's images.
3. Title gets a ` (copy)` suffix so the two are distinguishable in a list.
4. On success, redirect to `/new?draft={newId}` (S12's resume path) so the user lands in an editor, not on a detail page.
5. Enable the menu item and add it to `ListingRowActions`.

**Acceptance:** Duplicate a sold item — the copy is a DRAFT with no sale data and the same photos. Delete the original and confirm the copy's photos still load.

---

# PHASE 4 — Crosspost tracking  *(migration)*

This is the feature that makes the app a crossposting tool. Today it generates text and forgets. "Which of my items are on eBay?" is unanswerable.

## S15 — `ItemPosting` model and API

**Depends on:** S14.
**Files:** `prisma/schema.prisma` + migration, `lib/item-schema.ts`, `app/api/items/[id]/postings/route.ts` (new), `lib/item-dto.ts`, `lib/postings.ts` (new) + test.

```prisma
model ItemPosting {
  id        String   @id @default(cuid())
  itemId    String
  item      Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  platform  Platform
  postedAt  DateTime @default(now())
  url       String?  // optional link back to the live listing
  removedAt DateTime?

  @@unique([itemId, platform])
  @@index([itemId])
}
```

1. `removedAt` lets a posting be marked taken-down without losing the history; a null `removedAt` means live. `@@unique([itemId, platform])` means re-posting is an **upsert, not an error**.
2. **`POST /api/items/[id]/postings`** — `{ platform, url? }`, upserts and clears `removedAt`. **`DELETE`** with `{ platform }` sets `removedAt`. Both auth-gated, both Zod-validated, both 404 on a missing item.
3. **`GET`** is not needed — postings come down with the page's own Prisma query.
4. **`lib/postings.ts`** holds the pure helpers: `livePlatforms(postings)`, `postingSummary(postings)` → `"2 of 3 marketplaces"`, `missingPlatforms(postings)`. Tested.
5. **DTO:** add `postings: ItemPostingDto[]` to `ItemDto` via `toItemDto`, defaulting to `[]` so every existing call site that builds a DTO by hand (`buildDraftItemDto`, and the preview helper from S2) keeps compiling. Grep for every construction site before changing the type.

**Acceptance:** Migration applies cleanly. Posting the same platform twice is idempotent. Deleting an item cascades its postings. `npm test` covers the helpers.

---

## S16 — Channel tiles on the detail page

**Depends on:** S15.
**Files:** `components/item/ChannelTiles.tsx` (new), `app/listings/[id]/page.tsx`, `components/CopyListingSection.tsx`, `components/useListingCopy.ts`.

1. **Three tiles** — Facebook, Depop, eBay — each showing posted state (`Posted Aug 2` / `Not posted`) and a primary action **`Copy & mark posted`** that in one click writes `title + "\n\n" + body` to the clipboard *and* records the posting. Header line: `{n} of 3 marketplaces`.
2. **Clipboard failure must not create a phantom posting.** `useListingCopy` already has a failure path that sets a user-visible error — the POST only fires after `navigator.clipboard.writeText` resolves. Test this by denying clipboard permission.
3. Posted tiles switch their primary to `Copy again` and offer `Mark as removed` in a secondary position.
4. **Optional listing URL:** a small "Add link" affordance per posted tile, saved to `ItemPosting.url`, rendered as an external link afterwards. `target="_blank"` + `rel="noreferrer"`.
5. `CopyListingSection` stays as the text preview; the tiles sit directly above it. `/new` renders the copy section too — that call site must keep working unchanged, tiles-free (an unsaved draft has no item id to post against). Any new props are optional.
6. Phones: tiles stack 1-up, full-width, `min-h-11` actions.

**Acceptance:** One click both copies and records, verified in the network panel and by reload. Denying clipboard permission records nothing and surfaces the existing error. `/new` is unaffected.

---

## S17 — Posted state in `/listings`

**Depends on:** S16.
**Files:** `app/listings/page.tsx`, `components/listings/ListingCard.tsx`, `components/ListingsTable.tsx`, `components/ListingsFilterBar.tsx`, `lib/listing-filters.ts`.

1. **Card and row show a compact channel indicator** — three initials or dots, filled for live postings, muted otherwise, with an accessible label (`Posted to Facebook and Depop`). Not a decorative-only signal.
2. **Filter: `Not on ▾ Facebook | Depop | eBay`** — the "what haven't I crossposted yet" question. Predicate lives in `lib/listing-filters.ts` alongside S7's.
3. **Sort by channel count** joins `SORT_OPTIONS`.
4. **Include postings in the S6 `select`** — a nested `select` of `{ platform, removedAt }` only. Do not fetch posting `url`s for a list view.
5. **A LISTED item posted nowhere is a real workflow gap** — surface it as a fourth attention filter (`Listed but not posted`) and add it to `buildAttention` in `lib/dashboard.ts` so the homepage raises it too.

**Acceptance:** Filter to "Not on eBay" and confirm the set matches what the tiles show per item. The homepage attention card counts the same set.

---

# PHASE 5 — Edit ergonomics

## S18 — Inline quick-edit from the detail page

**Depends on:** S4.
**Files:** `components/item/PricePanel.tsx`, `components/item/QuickEditField.tsx` (new), `app/listings/[id]/page.tsx`.

Changing a price is currently: detail → edit page (full load) → change → save → redirect back. Two navigations for one number.

1. **`QuickEditField`** — click a value to edit in place, Enter commits, Escape cancels, blur commits. Optimistic update with rollback and an error toast on failure.
2. Apply to **list price** and **title** only. Everything else stays on the edit page; the point is the two fields changed most often, not a second editor.
3. It PATCHes `action: "update"` — which requires the **whole** `UpdateItemSchema` payload, not a partial. Either send the full current values with the one field changed (simplest, and the page already has them), or add a `patch_fields` action with a partial schema. Prefer sending the full payload; if you add an action, it must validate the same constraints.
4. `min-h-11` targets; on phones the tap target is the whole value row.
5. The edit page remains the canonical editor and must be unaffected.

**Acceptance:** Change a price from the detail page without a navigation; profit and ROI on the panel update; reload confirms persistence; a forced 500 rolls the value back and says so.

---

## S19 — Re-run AI from the edit page

**Depends on:** S13, S18.
**Files:** `components/item/EditListingForm.tsx`, `app/api/analyze/route.ts`.

1. **"Re-analyze photos"** in the edit page header, using the item's current photo URLs.
2. **Never overwrite silently.** Show a diff — for each field the analysis would change, the current value, the proposed value, and a per-field checkbox, defaulting to unchecked. Apply writes only checked fields into the draft (still unsaved, so Discard works).
3. Reuse the existing analyzing state language and `aria-live="polite"`.
4. Update the AI reference fields (`suggestedPrice`, `priceLow`, `priceHigh`, `priceReasoning`, `aiConfidence`) when applied — `UpdateItemSchema` does **not** currently accept them ("AI reference fields, status, and sale fields have separate ownership"). Add an `apply_analysis` action to `ItemMutationSchema` rather than widening `UpdateItemSchema`, so the ownership boundary stays intact.
5. Show the cost line (`lib/model-pricing.ts` `formatUsageLine`) as `/new` does — re-analysis costs money and the user should see it before and after.

**Acceptance:** Re-analyze an item, accept only the price, and confirm the title is untouched. Discard reverts everything. The cost line renders.

---

## S20 — Replace `window.confirm` with a real dialog

**Depends on:** S19.
**Files:** `components/item/EditListingForm.tsx`, `components/UnsavedChangesDialog.tsx` (new).

`EditListingForm` guards navigation with a capture-phase `document` click listener on every anchor plus `window.confirm` plus `beforeunload`. It works, but it is fragile and looks nothing like the rest of the app.

1. **A native `<dialog>`** matching the delete dialog in `ItemActionBar` — `Save changes` / `Discard and leave` / `Cancel`, focus trapped by `showModal()`, Escape cancels.
2. Keep the `beforeunload` handler — a browser-level reload/close cannot be intercepted by a custom dialog, and that is correct.
3. Keep the capture-phase interception (it is the only way to gate a `Link` here) but route it into the dialog instead of `confirm`, deferring the navigation until the choice is made. Preserve the existing bail-outs: `defaultPrevented`, non-left-click, modifier keys, `target="_blank"`, `download`, cross-origin, and `data-draft-guarded="true"`.
4. **`Save changes` from the dialog** must complete the save and *then* navigate to the original destination.

**Acceptance:** Edit a field, click Home in the header — the dialog appears; each of the three buttons does exactly what it says; Cmd/Ctrl-click still opens a new tab without prompting; a browser reload still shows the native warning.

---

# PHASE 6 — Sales

## S21 — Shipping cost and net profit  *(migration)*

**Depends on:** S10.
**Files:** `prisma/schema.prisma` + migration, `lib/analytics.ts` + test, `lib/item-schema.ts`, `components/MarkSoldDialog.tsx`, `components/item/SaleSummary.tsx`, `lib/queries/sales.ts`, `components/analytics/*`.

Profit today is `sold − purchase − fees`. Anything shipped is overstated.

1. **Schema:** `Item.shippingCost Decimal? @db.Decimal(10, 2)`, nullable, no default — null means "not recorded", distinct from a recorded zero.
2. **`computeProfit` subtracts `shippingCost ?? 0`.** This is the highest-blast-radius change in the plan: `SellableItem`, `lib/analytics.test.ts`, `lib/dashboard.ts`, `lib/queries/sales.ts`, `lib/profit-bars.ts`, `lib/sales-view.ts`, the analytics components, `PricePanel`, `SaleSummary`, and `MarkSoldDialog`'s live preview all consume it. Grep for every `computeProfit`/`computeRoi` call site and check each one. Extend the existing tests before changing the function.
3. **`MarkSoldSchema` gains `shippingCost: money.nonnegative().nullable()`**, and the dialog gains the field next to Platform fees, with the same touched-once-never-auto-overwritten behaviour the fees field has. The arithmetic line becomes `$65.00 − $6.00 paid − $8.61 fees − $12.00 shipping`.
4. **`SaleSummary`'s fee warning** gains a shipping counterpart, and both must read as advisory, not error.
5. **Existing sold items keep null shipping** and their profit is unchanged. Verify a seeded historical item reports the same profit before and after the migration.

**Acceptance:** `npm test` green with new cases for shipping. An item sold at $65 / paid $6 / fees $8.61 / shipping $12 reports $38.39 profit identically on the detail page, `/analytics`, and the homepage.

---

## S22 — Record a sale from anywhere

**Depends on:** S21.
**Files:** `components/MarkSoldDialog.tsx`, `components/listings/ListingRowActions.tsx`, `components/item/ItemActionBar.tsx`, `components/DashboardListings.tsx`.

1. **Mark-sold reachable from every surface that shows an item**: card, table row, detail bar (already), and the homepage recent-items list. All go through the one `MarkSoldDialog`, all get the S10 undo toast.
2. **A DRAFT can be marked sold.** `MarkSoldSchema` has no status precondition, and `mark_sold` only rejects an already-SOLD item — so this already works at the API level; make sure the UI does not hide the action for DRAFT items. An item sold before you finished listing it is a normal occurrence.
3. **Selecting a platform in the dialog auto-records an `ItemPosting`** for it if none exists (S15) — you cannot sell somewhere you never posted, and this keeps the crosspost history honest. Do it server-side inside the `mark_sold` handler so it cannot drift from the sale record.
4. Verify the dialog's bottom-sheet treatment below `sm` still works from every new call site (it is `mx-0 mt-auto … sm:m-auto`).

**Acceptance:** Mark sold from all four surfaces; each refreshes its own view, offers undo, and produces a posting record for the sale platform. A DRAFT can be sold and lands in `/analytics`.

---

# PHASE 7 — Performance

## S23 — `next/image` pipeline

**Depends on:** everything above (it touches every surface).
**Files:** `next.config.ts`, `components/listings/ListingCard.tsx`, `components/ListingsTable.tsx`, `components/item/ItemGallery.tsx`, `components/item/PhotoManager.tsx`, `components/DashboardListings.tsx`, `app/new/page.tsx`.

Every image is a raw `<img>` with an eslint-disable, serving a 1600px JPEG into a 40px table thumbnail.

1. **`next.config.ts`**: add `images.remotePatterns` for the Supabase public storage host, from `NEXT_PUBLIC_SUPABASE_URL`. Read the images docs in `node_modules/next/dist/docs/` first — this Next version's config shape may differ from what you remember.
2. **Convert every remote-URL `<img>`**, with correct `sizes` per surface: table thumb 40px, card ~400px, gallery hero ~440px, gallery thumb ~100px. Remove each `eslint-disable-next-line @next/next/no-img-element` as you go.
3. **Blob preview URLs in `PhotoManager` stay as plain `<img>`** — `next/image` cannot optimize an object URL. Keep those disables and leave a one-line comment saying why.
4. Card and gallery images get explicit aspect ratios so nothing shifts on load.
5. Only the first row of listing images is eager; the rest lazy.

**Acceptance:** A 48-item listings page transfers dramatically less image data (record before/after). No layout shift on load. The gallery lightbox still shows the full-resolution image.

---

## S24 — Orphaned-upload sweep

**Depends on:** S23.
**Files:** `app/api/upload/route.ts`, `lib/photos.ts`, a small script or route under `app/api/` — state which.

S12 largely stops orphans at the source, but historical ones exist and a killed tab can still leave one.

1. An authenticated maintenance endpoint that lists objects in the bucket, checks each against `prisma.item.count({ where: { photos: { has: url } } })`, and deletes the unreferenced ones **older than 24 hours** (younger objects may belong to an in-flight draft).
2. Dry-run by default; deleting requires an explicit flag in the request.
3. Report counts scanned / orphaned / deleted / failed.
4. **This is destructive** — the 24-hour floor and the dry-run default are both required, not optional.

**Acceptance:** Dry run on a bucket with a known orphan identifies exactly it and touches nothing. The live run deletes it and leaves every referenced photo intact.

---

## Open questions — resolve before the phase in question

1. **S2 option A or B.** A (promote `description`) is recommended and needs no migration; B is more honest about the two fields but keeps a concept the user must learn. Decide before dispatching S2 — everything downstream inherits it.
2. **S12 autosave cadence.** 1.5s debounce with last-write-wins is proposed. If a stricter guarantee is wanted (optimistic concurrency via `updatedAt`), say so now; retrofitting it after S14–S17 build on the draft flow is expensive.
3. **S15 `ItemPosting.url`.** Included as optional. If you will never paste listing URLs back in, drop the column and S16.4 with it.
4. **S21 blast radius.** Adding shipping to `computeProfit` changes every historical profit figure for any item you later backfill. If you would rather keep profit as-is and show shipping only as an advisory line, say so — it is a much smaller change.
5. **S9 bulk delete undo.** Proposed as no-undo, because undo would mean soft deletes and a photo-retention policy. Confirm.
6. **Item history / activity log.** Not in this plan. Would answer "when did I drop the price?" — needs its own model. Defer unless you want it.

---

## Out of scope

Multi-user accounts and per-user data scoping; automated posting to marketplaces via their APIs (this stays copy-and-paste); offline support; CSV import (`lib/csv.ts` handles export only); a settings surface for fee rates; `/analytics` beyond the `computeProfit` ripple in S21; and rate limiting `/api/analyze`.

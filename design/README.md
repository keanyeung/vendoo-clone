# Design handoff — Vendoo Clone UI changes

Two screens are ready to implement. Each has a **visual reference** (self-contained HTML you can open in a browser and read the source of), **flat screenshots**, and an **implementation brief**.

Unzip this folder into the repo root as `design/`, so paths resolve as `design/home.html`, `design/HOME_REDESIGN.md`, etc. The briefs reference those paths.

## Contents

| File | What it is |
|---|---|
| `HOME_REDESIGN.md` | Brief — homepage dashboard + persistent app shell |
| `home.html` | Visual reference, homepage |
| `home-dashboard.png` | Screenshot, homepage |
| `NEW_LISTING_REDESIGN.md` | Brief — `/new` flow, desktop + phone |
| `new-listing.html` | Visual reference, `/new`. **Use the Turn 2 section** (`id="2a"` desktop, `id="2b"` phone) and `id="1c"` for the post-save screen. Turn 1 `1a`/`1b` is a superseded exploration — ignore. |
| `new-listing-desktop.png` | Screenshot, `/new` desktop |
| `new-listing-phone.png` | Screenshot, `/new` phone |

## Order of work

**`HOME_REDESIGN.md` Task 1 first** — it creates the `AppHeader` shell and strips duplicated nav from every page. The `/new` brief assumes it exists. Everything else can follow in either order.

## Prompt to paste into Claude Code

> Read `design/HOME_REDESIGN.md` and `design/NEW_LISTING_REDESIGN.md`, and open `design/home.html` and `design/new-listing.html` to read their source as the visual reference.
>
> Implement `HOME_REDESIGN.md` Task 1 first — it creates the app shell both briefs depend on. Then work through the rest. Each brief ends with a suggested agent split; follow it, running the independent tasks in parallel and respecting the stated dependencies.
>
> Constraints, both briefs: no new dependencies, no changes to `prisma/schema.prisma`, server components unless interactivity is required, and every new surface must work in light **and** dark mode using the existing Tailwind pairs — the reference HTML is dark-only, so translate the literal hex values rather than hardcoding them.
>
> Do not touch `/listings`, `/listings/[id]`, or `/analytics` beyond removing their duplicated nav links.
>
> Finish with `npm run lint` and `npx tsc --noEmit` clean, and check each screen at 1440 / 1024 / 768 / 390px in both color schemes.

## What is NOT in these briefs

Deliberately deferred: `/listings` redesign, item detail page consolidation, `/analytics`, bulk multi-select + delete, and per-marketplace crosspost status tracking.

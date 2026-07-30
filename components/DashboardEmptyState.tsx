import Link from "next/link";

// Border-only, like the empty state on /listings — a filled card here would outweigh the greeting
// above it, and this is the only block on the page when the inventory is empty.
export default function DashboardEmptyState() {
  return (
    <section className="mt-7 rounded-xl border border-black/15 px-6 py-12 text-center dark:border-white/20">
      <h2 className="text-lg font-semibold">Add your first item</h2>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Photograph an item and let AI draft the listing, then track its sale and
        profit here.
      </p>
      <Link
        href="/new"
        className="mt-5 inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background"
      >
        New listing
      </Link>
    </section>
  );
}

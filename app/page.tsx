import { logout } from "@/app/actions/auth";
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Vendoo Clone</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/new"
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background"
          >
            New Listing
          </Link>
          <Link
            href="/listings"
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            Listings
          </Link>
          <Link
            href="/analytics"
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            Analytics
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      <p className="mt-6 text-sm text-black/60 dark:text-white/60">
        Photograph an item and let AI draft the listing details. Then save it to
        your inventory. Track your sales and profit in Analytics.
      </p>
    </main>
  );
}

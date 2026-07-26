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
        Phase 0 foundation is live — Next.js, Postgres (Prisma), and the login
        gate are wired up. Next phases will add photo upload, AI listing drafts,
        the inventory view, and analytics.
      </p>
    </main>
  );
}

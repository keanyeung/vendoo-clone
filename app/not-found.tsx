import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <section className="rounded-xl border border-black/15 p-6 dark:border-white/20">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          The page you requested does not exist or may have moved.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Go home
          </Link>
          <Link
            href="/listings"
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/20"
          >
            View listings
          </Link>
        </div>
      </section>
    </main>
  );
}

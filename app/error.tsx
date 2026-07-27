"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <section className="rounded-xl border border-black/15 p-6 dark:border-white/20">
        <h1 className="text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          We could not load this page. Please try again.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-black/50 dark:text-white/50">
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Try again
        </button>
      </section>
    </main>
  );
}

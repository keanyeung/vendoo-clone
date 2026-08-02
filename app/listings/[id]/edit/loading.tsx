const skeleton =
  "motion-safe:animate-pulse rounded bg-black/10 dark:bg-white/10";
const panel =
  "rounded-xl border border-black/15 bg-black/[.02] dark:border-white/20 dark:bg-white/[.02]";

export default function Loading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Loading listing editor…
      </p>

      <div
        aria-hidden="true"
        className="sticky top-15 z-[9] border-b border-black/10 bg-background/90 dark:border-white/15"
      >
        <div className="mx-auto flex min-h-15 w-full max-w-[1180px] items-center gap-2 px-4 py-2 sm:px-6">
          <div className={`${skeleton} size-11 sm:w-24`} />
          <div className={`${skeleton} h-5 min-w-0 flex-1 max-w-72`} />
          <div className={`${skeleton} hidden h-4 w-28 sm:block`} />
          <div className={`${skeleton} h-11 w-20`} />
          <div className={`${skeleton} h-11 w-28`} />
        </div>
      </div>

      <main
        aria-busy="true"
        className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 pb-10 sm:px-6"
      >
        <div aria-hidden="true" className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 max-w-[520px] flex-[1_1_440px]">
            <section className={`${panel} p-4`}>
              <div className="flex items-center justify-between gap-3">
                <div className={`${skeleton} h-5 w-24`} />
                <div className={`${skeleton} h-9 w-28`} />
              </div>
              <div className={`${skeleton} mt-4 aspect-square w-full`} />
              <div className="mt-3 grid grid-cols-4 gap-2.5">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className={`${skeleton} aspect-square`} />
                ))}
              </div>
            </section>
            <section className={`${panel} mt-3 p-4`}>
              <div className={`${skeleton} h-5 w-20`} />
              <div className={`${skeleton} mt-3 h-3 w-full`} />
              <div className={`${skeleton} mt-2 h-3 w-4/5`} />
            </section>
          </div>

          <div className="min-w-0 flex-[1_1_520px] space-y-3">
            <section className={`${panel} p-5 sm:p-6`}>
              <div className={`${skeleton} h-5 w-32`} />
              <div className={`${skeleton} mt-5 h-11 w-full`} />
              <div className={`${skeleton} mt-4 h-32 w-full`} />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className={`${skeleton} h-16 w-full`} />
                <div className={`${skeleton} h-16 w-full`} />
              </div>
            </section>

            <section className={`${panel} p-5 sm:p-6`}>
              <div className={`${skeleton} h-5 w-36`} />
              <div className={`${skeleton} mt-4 h-10 w-full`} />
              <div className={`${skeleton} mt-3 h-24 w-full`} />
            </section>

            <section className={`${panel} p-5 sm:p-6`}>
              <div className={`${skeleton} h-5 w-28`} />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className={`${skeleton} h-16 w-full`} />
                ))}
              </div>
              <div className={`${skeleton} mt-4 h-24 w-full`} />
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

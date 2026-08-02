const skeleton =
  "motion-safe:animate-pulse rounded bg-black/10 dark:bg-white/10";
const panel =
  "rounded-xl border border-black/15 bg-black/[.02] dark:border-white/20 dark:bg-white/[.02]";

export default function Loading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Loading item…
      </p>

      <div
        aria-hidden="true"
        className="sticky top-15 z-[9] border-b border-black/10 bg-background/90 dark:border-white/15"
      >
        <div className="mx-auto flex min-h-15 w-full max-w-[1120px] items-center gap-3 px-4 py-2 sm:px-6">
          <div className={`${skeleton} size-11 sm:w-20`} />
          <div className={`${skeleton} h-5 min-w-0 flex-1 max-w-64`} />
          <div className={`${skeleton} hidden h-7 w-16 sm:block`} />
          <div className={`${skeleton} h-11 w-24`} />
          <div className={`${skeleton} size-11`} />
        </div>
      </div>

      <main
        aria-busy="true"
        className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-6 sm:px-6"
      >
        <div aria-hidden="true" className="flex flex-wrap items-start gap-9">
          <div className="min-w-0 max-w-[440px] flex-[1_1_400px]">
            <div className={`${skeleton} aspect-square w-full rounded-[14px]`} />
            <div className="mt-3 grid grid-cols-4 gap-2.5">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className={`${skeleton} aspect-square`} />
              ))}
            </div>
            <div className={`${skeleton} mt-4 h-4 w-48`} />
          </div>

          <div className="min-w-0 flex-[1_1_560px]">
            <section className={`${panel} p-6`}>
              <div className="grid gap-5 sm:grid-cols-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index}>
                    <div className={`${skeleton} h-4 w-24`} />
                    <div className={`${skeleton} mt-2 h-9 w-28`} />
                    <div className={`${skeleton} mt-2 h-3 w-32 max-w-full`} />
                  </div>
                ))}
              </div>
            </section>

            <section className={`${panel} mt-3 p-6`}>
              <div className={`${skeleton} h-5 w-36`} />
              <div className={`${skeleton} mt-4 h-10 w-full`} />
              <div className={`${skeleton} mt-3 h-24 w-full`} />
            </section>

            <section className={`${panel} mt-8 p-6`}>
              <div className={`${skeleton} h-6 w-36`} />
              <div className={`${skeleton} mt-5 h-4 w-full`} />
              <div className={`${skeleton} mt-3 h-4 w-[88%]`} />
              <div className={`${skeleton} mt-3 h-4 w-[72%]`} />
              <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index}>
                    <div className={`${skeleton} h-4 w-20`} />
                    <div className={`${skeleton} mt-2 h-5 w-28`} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

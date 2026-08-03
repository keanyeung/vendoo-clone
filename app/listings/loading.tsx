const skeleton =
  "motion-safe:animate-pulse rounded bg-black/10 dark:bg-white/10";
const panel =
  "rounded-xl border border-black/15 bg-black/[.02] dark:border-white/20 dark:bg-white/[.02]";

export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 xl:px-8"
    >
      <p role="status" aria-live="polite" className="sr-only">
        Loading listings…
      </p>

      <div aria-hidden="true">
        <div className={`${skeleton} h-8 w-32`} />
        <div className={`${skeleton} mt-1.5 h-5 w-28`} />

        <section className={`${panel} mt-6 flex flex-col gap-4 p-4 sm:flex-row`}>
          <div className="sm:w-36">
            <div className={`${skeleton} h-4 w-12`} />
            <div className={`${skeleton} mt-1 h-10 w-full`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={`${skeleton} h-4 w-14`} />
            <div className={`${skeleton} mt-1 h-10 w-full`} />
          </div>
          <div className="sm:w-52">
            <div className={`${skeleton} h-4 w-10`} />
            <div className={`${skeleton} mt-1 h-10 w-full`} />
          </div>
          <div className={`${skeleton} h-11 w-24 self-end`} />
        </section>

        <div className="mt-6 flex justify-end">
          <div className={`${skeleton} h-10 w-36`} />
        </div>

        <section className={`${panel} mt-8 overflow-hidden`}>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b border-black/10 p-4 last:border-b-0 dark:border-white/15"
            >
              <div className={`${skeleton} size-16 shrink-0 sm:size-20`} />
              <div className="min-w-0 flex-1">
                <div className={`${skeleton} h-5 w-56 max-w-full`} />
                <div className={`${skeleton} mt-2 h-4 w-36 max-w-[80%]`} />
                <div className={`${skeleton} mt-3 h-3 w-24`} />
              </div>
              <div className="hidden shrink-0 sm:block">
                <div className={`${skeleton} h-5 w-20`} />
                <div className={`${skeleton} mt-3 h-6 w-16`} />
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

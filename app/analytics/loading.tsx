const skeleton = "animate-pulse rounded bg-black/10 dark:bg-white/10";
const panel =
  "rounded-xl border border-black/15 bg-black/[.02] dark:border-white/20 dark:bg-white/[.02]";

export default function Loading() {
  return (
    <main
      aria-hidden="true"
      className="mx-auto w-full max-w-[1120px] flex-1 px-6 pt-8 pb-16"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className={`${skeleton} h-8 w-32`} />
          <div className={`${skeleton} mt-1.5 h-5 w-64 max-w-full`} />
        </div>
        <div className="flex rounded-lg border border-black/15 p-1 dark:border-white/20">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={`${skeleton} mx-1 h-9 w-20`} />
          ))}
        </div>
      </div>

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={`${panel} px-4.5 py-4`}>
            <div className={`${skeleton} h-3 w-20`} />
            <div className={`${skeleton} mt-3 h-8 w-28`} />
            <div className={`${skeleton} mt-2 h-3 w-36 max-w-full`} />
          </div>
        ))}
      </section>

      <section className={`${panel} mt-3 p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={`${skeleton} h-5 w-32`} />
            <div className={`${skeleton} mt-2 h-4 w-56 max-w-full`} />
          </div>
          <div className={`${skeleton} h-9 w-44`} />
        </div>
        <div className="mt-8 flex h-[180px] items-end gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex h-full min-w-0 flex-1 items-end">
              <div
                className={`${skeleton} w-full rounded-t`}
                style={{ height: `${28 + index * 9}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-black/10 pt-4 dark:border-white/15">
          <div className={`${skeleton} h-5 w-28`} />
        </div>
      </section>

      <section className={`${panel} mt-3 overflow-hidden`}>
        <div className="flex items-start justify-between gap-4 p-5">
          <div>
            <div className={`${skeleton} h-5 w-24`} />
            <div className={`${skeleton} mt-2 h-4 w-72 max-w-full`} />
          </div>
          <div className={`${skeleton} h-10 w-56`} />
        </div>
        <div className="border-t border-black/10 px-5 dark:border-white/15">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b border-black/10 py-4 last:border-b-0 dark:border-white/15"
            >
              <div className={`${skeleton} size-[34px] shrink-0`} />
              <div className={`${skeleton} h-4 flex-1`} />
              <div className={`${skeleton} hidden h-4 w-20 sm:block`} />
              <div className={`${skeleton} h-4 w-16`} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-black/10 px-5 py-4 dark:border-white/15">
          <div className={`${skeleton} h-3 w-80 max-w-[70%]`} />
          <div className={`${skeleton} h-3 w-20`} />
        </div>
      </section>
    </main>
  );
}

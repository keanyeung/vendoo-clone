import Link from "next/link";

import {
  buildListingsHref,
  type ListingContext,
} from "@/lib/listing-context";

type ListingsPaginationProps = {
  context: ListingContext;
  page: number;
  pageCount: number;
};

const linkClassName =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]";
const disabledClassName =
  "inline-flex min-h-11 min-w-11 cursor-not-allowed items-center justify-center rounded-md border border-black/10 px-3 text-sm font-medium text-black/30 dark:border-white/10 dark:text-white/30";

export default function ListingsPagination({
  context,
  page,
  pageCount,
}: ListingsPaginationProps) {
  if (pageCount <= 1) return null;

  const hrefForPage = (targetPage: number) =>
    buildListingsHref({ ...context, page: targetPage });
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  const previous =
    page === 1 ? (
      <button
        type="button"
        disabled
        aria-label="Previous page"
        className={disabledClassName}
      >
        <span aria-hidden="true">{"<"}</span>
      </button>
    ) : (
      <Link
        href={hrefForPage(page - 1)}
        prefetch={false}
        aria-label="Previous page"
        className={linkClassName}
      >
        <span aria-hidden="true">{"<"}</span>
        <span className="hidden sm:inline">&nbsp;Previous</span>
      </Link>
    );
  const next =
    page === pageCount ? (
      <button
        type="button"
        disabled
        aria-label="Next page"
        className={disabledClassName}
      >
        <span aria-hidden="true">{">"}</span>
      </button>
    ) : (
      <Link
        href={hrefForPage(page + 1)}
        prefetch={false}
        aria-label="Next page"
        className={linkClassName}
      >
        <span className="hidden sm:inline">Next&nbsp;</span>
        <span aria-hidden="true">{">"}</span>
      </Link>
    );

  return (
    <nav aria-label="Listings pages" className="mt-8">
      <div className="flex items-center justify-between gap-3 sm:hidden">
        {previous}
        <p className="text-sm tabular-nums text-black/60 dark:text-white/60">
          Page {page} of {pageCount}
        </p>
        {next}
      </div>

      <div className="hidden flex-wrap items-center justify-center gap-2 sm:flex">
        {previous}
        {pages.map((pageNumber) => (
          <Link
            key={pageNumber}
            href={hrefForPage(pageNumber)}
            prefetch={false}
            aria-label={`Page ${pageNumber}`}
            aria-current={pageNumber === page ? "page" : undefined}
            className={`${linkClassName} ${
              pageNumber === page
                ? "border-foreground bg-foreground text-background hover:bg-foreground dark:border-foreground dark:hover:bg-foreground"
                : ""
            }`}
          >
            {pageNumber}
          </Link>
        ))}
        {next}
      </div>
    </nav>
  );
}

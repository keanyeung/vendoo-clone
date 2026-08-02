export const PAGE_SIZE = 48;

export function parsePage(raw: string | null | undefined): number {
  if (!raw) return 1;

  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function paginate<T>(items: readonly T[], requestedPage: number) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const validRequestedPage =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const page = Math.min(validRequestedPage, pageCount);
  const start = (page - 1) * PAGE_SIZE;

  return {
    items: items.slice(start, start + PAGE_SIZE),
    page,
    pageCount,
    total,
  };
}

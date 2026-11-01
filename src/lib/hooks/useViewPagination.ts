import { useEffect, useMemo, useState } from 'react';

interface UseViewPaginationOptions {
  items: unknown[];
  groupedItemCount?: number;
  hasGroups: boolean;
  resetKey: string;
  initialRowsPerPage?: number;
}

export function useViewPagination({
  items,
  groupedItemCount = 0,
  hasGroups,
  resetKey,
  initialRowsPerPage = 50,
}: UseViewPaginationOptions) {
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
  const [page, setPage] = useState(1);

  const totalItems = hasGroups ? groupedItemCount : items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const effectivePage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (effectivePage - 1) * rowsPerPage;
    return items.slice(start, start + rowsPerPage);
  }, [effectivePage, items, rowsPerPage]);

  useEffect(() => {
    setPage(1);
  }, [resetKey, rowsPerPage]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return {
    rowsPerPage,
    setRowsPerPage,
    page: effectivePage,
    setPage,
    totalPages,
    paginatedItems,
  };
}

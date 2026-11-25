import { useEffect, useMemo, useRef, useState } from 'react';
import { databaseStorage } from '@/lib/databaseStorage';

interface UseViewPaginationOptions {
  items: unknown[];
  groupedItemCount?: number;
  hasGroups: boolean;
  resetKey: string;
  storageKey?: string;
  initialRowsPerPage?: number;
}

interface PaginationState {
  page: number;
  rowsPerPage: number;
}

function readPaginationState(storageKey: string | undefined, initialRowsPerPage: number): PaginationState {
  if (!storageKey) return { page: 1, rowsPerPage: initialRowsPerPage };
  try {
    const raw = databaseStorage.getItem(storageKey);
    const saved = raw ? JSON.parse(raw) : null;
    return {
      page: Number.isInteger(saved?.page) && saved.page > 0 ? saved.page : 1,
      rowsPerPage: Number.isInteger(saved?.rowsPerPage) && saved.rowsPerPage > 0
        ? saved.rowsPerPage
        : initialRowsPerPage,
    };
  } catch {
    return { page: 1, rowsPerPage: initialRowsPerPage };
  }
}

export function useViewPagination({
  items,
  groupedItemCount = 0,
  hasGroups,
  resetKey,
  storageKey,
  initialRowsPerPage = 50,
}: UseViewPaginationOptions) {
  const [initialState] = useState(() => readPaginationState(storageKey, initialRowsPerPage));
  const [rowsPerPage, setRowsPerPage] = useState(initialState.rowsPerPage);
  const [page, setPage] = useState(initialState.page);
  const loadedStorageKey = useRef(storageKey);
  const [stateStorageKey, setStateStorageKey] = useState(storageKey);
  const previousResetState = useRef({ resetKey, rowsPerPage: initialState.rowsPerPage });

  const totalItems = hasGroups ? groupedItemCount : items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const effectivePage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (effectivePage - 1) * rowsPerPage;
    return items.slice(start, start + rowsPerPage);
  }, [effectivePage, items, rowsPerPage]);

  useEffect(() => {
    if (loadedStorageKey.current === storageKey) return;
    loadedStorageKey.current = storageKey;
    setStateStorageKey(storageKey);
    const saved = readPaginationState(storageKey, initialRowsPerPage);
    setPage(saved.page);
    setRowsPerPage(saved.rowsPerPage);
    previousResetState.current = { resetKey, rowsPerPage: saved.rowsPerPage };
  }, [initialRowsPerPage, resetKey, storageKey]);

  useEffect(() => {
    const previous = previousResetState.current;
    if (previous.resetKey !== resetKey || previous.rowsPerPage !== rowsPerPage) {
      setPage(1);
      previousResetState.current = { resetKey, rowsPerPage };
    }
  }, [resetKey, rowsPerPage]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!storageKey || stateStorageKey !== storageKey) return;
    try {
      databaseStorage.setItem(storageKey, JSON.stringify({ page: effectivePage, rowsPerPage }));
    } catch {
      // La pagination reste utilisable si le stockage n'est pas disponible.
    }
  }, [effectivePage, rowsPerPage, stateStorageKey, storageKey]);

  return {
    rowsPerPage,
    setRowsPerPage,
    page: effectivePage,
    setPage,
    totalPages,
    paginatedItems,
  };
}

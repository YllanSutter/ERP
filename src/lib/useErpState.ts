import { useMemo } from 'react';
import { createErpStateStore } from '@/lib/stores/erpStateStore';

export function useErpState(orgKey: string | null = null) {
  const useStore = useMemo(() => createErpStateStore(orgKey), [orgKey]);
  return useStore();
}

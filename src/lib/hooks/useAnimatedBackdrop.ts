import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'erp:animated-backdrop';
const CHANGE_EVENT = 'erp:animated-backdrop-changed';
let fallbackEnabled = true;

function readEnabled() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? fallbackEnabled : stored !== 'false';
  } catch { return fallbackEnabled; }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useAnimatedBackdrop() {
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => true);
  const toggle = () => {
    fallbackEnabled = !readEnabled();
    try { localStorage.setItem(STORAGE_KEY, String(fallbackEnabled)); }
    catch { /* Keep the choice for this session when storage is unavailable. */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return { enabled, toggle };
}

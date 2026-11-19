/** Inclusive start, exclusive end over cumulative item offsets. */
export function virtualRange(offsets: number[], scrollTop: number, height: number, overscan = 400) {
  const count = Math.max(0, offsets.length - 1);
  const lower = (value: number) => {
    let lo = 0, hi = count;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (offsets[mid + 1] < value) lo = mid + 1; else hi = mid; }
    return lo;
  };
  return { start: lower(Math.max(0, scrollTop - overscan)), end: Math.min(count, lower(scrollTop + height + overscan) + 1) };
}

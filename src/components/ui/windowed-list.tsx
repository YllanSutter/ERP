import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { virtualRange } from '@/lib/virtualRange';

type Props<T extends { id: string }> = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  empty?: React.ReactNode;
  pinnedId?: string | null;
  estimatedHeight?: number;
  gap?: number;
};
function MeasuredItem({ id, onMeasure, children, gap, ...props }: React.HTMLAttributes<HTMLDivElement> & { id: string; gap: number; onMeasure: (id: string, height: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    const measure = () => onMeasure(id, node.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, [id, onMeasure]);
  return <div {...props} ref={ref} style={{ ...props.style, paddingBottom: gap }}>{children}</div>;
}
/** Variable-height windowing. Keep the last edited card and dragged card mounted. */
export function WindowedList<T extends { id: string }>({ items, renderItem, empty, pinnedId, estimatedHeight = 180, gap = 12, ...props }: Props<T>) {
  const root = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState(() => new Map<string, number>());
  const [viewport, setViewport] = useState({ top: 0, height: 450 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const enabled = items.length > 60;
  const frame = useRef(0);
  const updateViewport = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const node = root.current;
      if (node) setViewport(previous => previous.top === node.scrollTop && previous.height === node.clientHeight ? previous : { top: node.scrollTop, height: node.clientHeight });
    });
  }, []);
  useLayoutEffect(() => {
    if (!root.current || !enabled) return;
    const observer = new ResizeObserver(updateViewport); observer.observe(root.current); updateViewport();
    return () => { observer.disconnect(); cancelAnimationFrame(frame.current); };
  }, [enabled, updateViewport]);
  const measure = useCallback((id: string, height: number) => {
    if (height <= 0) return;
    setSizes(previous => previous.get(id) === height ? previous : new Map(previous).set(id, height));
  }, []);
  const offsets = useMemo(() => {
    const offsets = [0];
    for (const item of items) offsets.push(offsets[offsets.length - 1] + (sizes.get(item.id) || estimatedHeight));
    return offsets;
  }, [items, estimatedHeight, sizes]);
  const range = virtualRange(offsets, viewport.top, viewport.height);
  const indexes = new Set<number>();
  for (let i = range.start; i < range.end; i++) indexes.add(i);
  for (const id of [editingId, pinnedId]) { const index = id ? items.findIndex(item => item.id === id) : -1; if (index >= 0) indexes.add(index); }
  return <div {...props} ref={root} role="list" tabIndex={props.tabIndex ?? (enabled ? 0 : undefined)}
    onKeyDown={event => {
      props.onKeyDown?.(event);
      if (!enabled || event.target !== event.currentTarget || event.defaultPrevented) return;
      if (event.key === 'End' || event.key === 'Home') {
        event.preventDefault(); event.currentTarget.scrollTop = event.key === 'End' ? event.currentTarget.scrollHeight : 0;
      }
    }} onScroll={event => { props.onScroll?.(event); if (enabled) updateViewport(); }}>
    {!items.length ? empty : !enabled ? items.map((item, index) => <div role="listitem" key={item.id} style={{ marginBottom: index === items.length - 1 ? 0 : gap }}>{renderItem(item, index)}</div>) :
      <div style={{ position: 'relative', height: offsets[offsets.length - 1], overflowAnchor: 'none' }}>
        {[...indexes].sort((a,b) => a-b).map(index => {
          const item = items[index];
          return <MeasuredItem key={item.id} id={item.id} onMeasure={measure} gap={gap} role="listitem" aria-posinset={index + 1} aria-setsize={items.length}
            onFocusCapture={() => setEditingId(item.id)} onPointerDownCapture={() => setEditingId(item.id)} onContextMenuCapture={() => setEditingId(item.id)}
            style={{ position: 'absolute', top: offsets[index], left: 0, right: 0 }}>
            {renderItem(item, index)}
          </MeasuredItem>;
        })}
      </div>}
  </div>;
}

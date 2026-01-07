import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface DraggableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, opts: { isDragging: boolean; isOver: boolean }) => React.ReactNode;
  className?: string;
  renderContainer?: (children: React.ReactNode) => React.ReactNode;
}

function reorderById<T>(items: T[], getId: (item: T) => string, dragId: string, overId: string) {
  const current = [...items];
  const from = current.findIndex((it) => getId(it) === dragId);
  const to = current.findIndex((it) => getId(it) === overId);
  if (from === -1 || to === -1 || from === to) return items;
  const [moved] = current.splice(from, 1);
  current.splice(to, 0, moved);
  return current;
}

export function DraggableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  className,
  renderContainer,
}: DraggableListProps<T>) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragEnter = (id: string) => setOverId(id);
  const handleDragEnd = () => {
    setDragId(null);
    setOverId(null);
  };
  const handleDrop = (id: string) => {
    if (dragId && id) {
      const next = reorderById(items, getId, dragId, id);
      if (next !== items) onReorder(next);
    }
    handleDragEnd();
  };

  const children = items.map((item) => {
    const id = getId(item);
    const isDragging = dragId === id;
    const isOver = overId === id && dragId !== id;
    const content = renderItem(item, { isDragging, isOver });
    if (!React.isValidElement(content)) return null;

    const existingClass = (content.props as any).className || '';
    const mergedClass = cn(existingClass, 'cursor-grab', isDragging && 'opacity-60', isOver && 'outline outline-1 outline-cyan-500/60 rounded');
    const existingStyle = (content.props as any).style || {};

    return React.cloneElement(content, {
      key: id,
      draggable: true,
      onDragStart: (e: React.DragEvent) => { handleDragStart(id); content.props.onDragStart?.(e); },
      onDragEnter: (e: React.DragEvent) => { handleDragEnter(id); content.props.onDragEnter?.(e); },
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); content.props.onDragOver?.(e); },
      onDrop: (e: React.DragEvent) => { handleDrop(id); content.props.onDrop?.(e); },
      onDragEnd: (e: React.DragEvent) => { handleDragEnd(); content.props.onDragEnd?.(e); },
      className: mergedClass,
      style: { ...existingStyle, touchAction: 'none' }
    });
  });

  if (renderContainer) {
    return <>{renderContainer(children)}</>;
  }

  return <div className={cn("space-y-2", className)}>{children}</div>;
}

export default DraggableList;

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import './rich-text-editor.css';

type RichTextEditorProps = {
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
  className?: string;
  showToolbar?: boolean;
};

const extractPlainTextFromSlate = (nodes: any[]): string => {
  let text = '';

  const walk = (node: any) => {
    if (!node) return;
    if (typeof node.text === 'string') {
      text += node.text;
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child: any) => walk(child));
    }
    if (
      node.type === 'paragraph' ||
      node.type === 'heading-one' ||
      node.type === 'heading-two' ||
      node.type === 'list-item' ||
      node.type === 'task-item'
    ) {
      if (!text.endsWith('\n')) text += '\n';
    }
  };

  nodes.forEach((node) => walk(node));
  return text.replace(/\n+$/g, '').trim();
};

const parseIncomingValue = (value: any): string => {
  if (!value) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return extractPlainTextFromSlate(parsed);
    } catch {
      // ignore JSON parse error and fall back
    }

    if (typeof window !== 'undefined') {
      const text = new DOMParser().parseFromString(trimmed, 'text/html').body.textContent || '';
      return text;
    }

    return trimmed;
  }

  if (Array.isArray(value)) return extractPlainTextFromSlate(value);

  return '';
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  className,
  showToolbar = true,
}) => {
  const [internalValue, setInternalValue] = useState<string>(() => parseIncomingValue(value));

  useEffect(() => {
    setInternalValue(parseIncomingValue(value));
  }, [value]);

  return (
    <div className={cn('rte-container', className)}>
      {showToolbar && !readOnly && <div className="rte-toolbar" />}
      <textarea
        readOnly={readOnly}
        className={cn('rte-editor', readOnly && 'rte-readonly')}
        value={internalValue}
        placeholder="Écrire ici..."
        onChange={(event) => {
          const nextValue = event.target.value;
          setInternalValue(nextValue);
          if (!readOnly) onChange(nextValue);
        }}
      />
    </div>
  );
};

export default RichTextEditor;

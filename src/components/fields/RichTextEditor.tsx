import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createEditor, Descendant, Editor, Element as SlateElement, Transforms, Node, Path } from 'slate';
import { Slate, Editable, withReact, ReactEditor, useSlateStatic } from 'slate-react';
import { withHistory } from 'slate-history';
import { cn } from '@/lib/utils';
import './rich-text-editor.css';

type RichTextEditorProps = {
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
  className?: string;
  showToolbar?: boolean;
};


const DEFAULT_VALUE: Descendant[] = [
  { type: 'paragraph', children: [{ text: '' }] },
];

const isSlateValue = (value: any): value is Descendant[] => Array.isArray(value) && value.length > 0;

const parseIncomingValue = (value: any): Descendant[] => {
  if (!value) return DEFAULT_VALUE;
  if (isSlateValue(value)) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return DEFAULT_VALUE;
    try {
      const parsed = JSON.parse(trimmed);
      if (isSlateValue(parsed)) return parsed;
    } catch {
      // ignore JSON parse error and fall back
    }

    // Fallback: convert HTML or plain text to a simple paragraph
    const text = typeof window !== 'undefined'
      ? new DOMParser().parseFromString(trimmed, 'text/html').body.textContent || ''
      : trimmed;
    return [{ type: 'paragraph', children: [{ text }] }];
  }

  return DEFAULT_VALUE;
};

const serializeValue = (value: Descendant[]) => JSON.stringify(value);

const withTasks = (editor: Editor) => editor;

const isMarkActive = (editor: Editor, format: string) => {
  const marks = Editor.marks(editor) as Record<string, boolean> | null;
  return marks ? marks[format] === true : false;
};

const toggleMark = (editor: Editor, format: string) => {
  const active = isMarkActive(editor, format);
  if (active) Editor.removeMark(editor, format);
  else Editor.addMark(editor, format, true);
};

const LIST_TYPES = ['numbered-list', 'bulleted-list', 'task-list'];

const isBlockActive = (editor: Editor, format: string) => {
  const [match] = Editor.nodes(editor, {
    match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as SlateElement).type === format,
  });
  return !!match;
};

const toggleBlock = (editor: Editor, format: string) => {
  const isActive = isBlockActive(editor, format);
  const isList = LIST_TYPES.includes(format);

  Transforms.unwrapNodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      LIST_TYPES.includes((n as SlateElement).type),
    split: true,
  });

  let newType = isActive ? 'paragraph' : isList ? 'list-item' : format;
  Transforms.setNodes(editor, { type: newType } as any);

  if (!isActive && isList) {
    const block = { type: format, children: [] };
    Transforms.wrapNodes(editor, block as any);
  }
};

const insertTaskItem = (editor: Editor) => {
  const taskItem = {
    type: 'task-item',
    checked: false,
    collapsed: false,
    children: [{ type: 'paragraph', children: [{ text: '' }] }],
  };
  const taskList = {
    type: 'task-list',
    children: [taskItem],
  };
  Transforms.insertNodes(editor, taskList as any);
};

const getTaskItemEntry = (editor: Editor) =>
  Editor.above(editor, {
    match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as SlateElement).type === 'task-item',
  });

const getTaskListEntry = (editor: Editor, at?: Path) =>
  Editor.above(editor, {
    at,
    match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as SlateElement).type === 'task-list',
  });

const indentTaskItem = (editor: Editor) => {
  const entry = getTaskItemEntry(editor);
  if (!entry) return;
  const [node, path] = entry as [SlateElement, Path];
  const prevPath = Path.previous(path);
  const prevEntry = Editor.node(editor, prevPath);
  if (!prevEntry) return;
  const [prevNode] = prevEntry as [SlateElement, Path];
  if (!SlateElement.isElement(prevNode) || prevNode.type !== 'task-item') return;

  let childListPath = prevPath.concat(prevNode.children.length);
  const hasChildList = prevNode.children.some(
    (child) => SlateElement.isElement(child) && (child as SlateElement).type === 'task-list'
  );

  if (!hasChildList) {
    const newList = { type: 'task-list', children: [] };
    Transforms.insertNodes(editor, newList as any, { at: childListPath });
  } else {
    const index = prevNode.children.findIndex(
      (child) => SlateElement.isElement(child) && (child as SlateElement).type === 'task-list'
    );
    childListPath = prevPath.concat(index);
  }

  const target = childListPath.concat(0);
  Transforms.moveNodes(editor, { at: path, to: target });
};

const outdentTaskItem = (editor: Editor) => {
  const entry = getTaskItemEntry(editor);
  if (!entry) return;
  const [node, path] = entry as [SlateElement, Path];
  const parentListPath = Path.parent(path);
  const parentEntry = Editor.node(editor, parentListPath) as [SlateElement, Path];
  if (!parentEntry || parentEntry[0].type !== 'task-list') return;

  const parentItemPath = Path.parent(parentListPath);
  const parentItemEntry = Editor.node(editor, parentItemPath) as [SlateElement, Path];
  if (!parentItemEntry || parentItemEntry[0].type !== 'task-item') return;

  const insertPath = Path.next(parentItemPath);
  Transforms.moveNodes(editor, { at: path, to: insertPath });
};

const ToolbarButton = ({
  active,
  onMouseDown,
  children,
  title,
}: {
  active?: boolean;
  onMouseDown: (event: React.MouseEvent) => void;
  children: React.ReactNode;
  title?: string;
}) => (
  <button
    type="button"
    className={cn('rte-btn', active && 'rte-btn-active')}
    onMouseDown={onMouseDown}
    title={title}
  >
    {children}
  </button>
);

const RichTextToolbar = ({ editor }: { editor: Editor }) => (
  <div className="rte-toolbar">
    <ToolbarButton
      active={isMarkActive(editor, 'bold')}
      onMouseDown={(e) => {
        e.preventDefault();
        toggleMark(editor, 'bold');
      }}
      title="Gras"
    >
      <b>B</b>
    </ToolbarButton>
    <ToolbarButton
      active={isMarkActive(editor, 'italic')}
      onMouseDown={(e) => {
        e.preventDefault();
        toggleMark(editor, 'italic');
      }}
      title="Italique"
    >
      <i>I</i>
    </ToolbarButton>
    <ToolbarButton
      active={isMarkActive(editor, 'underline')}
      onMouseDown={(e) => {
        e.preventDefault();
        toggleMark(editor, 'underline');
      }}
      title="Souligné"
    >
      <u>U</u>
    </ToolbarButton>
    <ToolbarButton
      active={isBlockActive(editor, 'heading-one')}
      onMouseDown={(e) => {
        e.preventDefault();
        toggleBlock(editor, 'heading-one');
      }}
      title="Titre 1"
    >
      H1
    </ToolbarButton>
    <ToolbarButton
      active={isBlockActive(editor, 'heading-two')}
      onMouseDown={(e) => {
        e.preventDefault();
        toggleBlock(editor, 'heading-two');
      }}
      title="Titre 2"
    >
      H2
    </ToolbarButton>
    <ToolbarButton
      active={isBlockActive(editor, 'bulleted-list')}
      onMouseDown={(e) => {
        e.preventDefault();
        toggleBlock(editor, 'bulleted-list');
      }}
      title="Liste à puces"
    >
      •
    </ToolbarButton>
    <ToolbarButton
      active={isBlockActive(editor, 'numbered-list')}
      onMouseDown={(e) => {
        e.preventDefault();
        toggleBlock(editor, 'numbered-list');
      }}
      title="Liste numérotée"
    >
      1.
    </ToolbarButton>
    <ToolbarButton
      active={isBlockActive(editor, 'task-list')}
      onMouseDown={(e) => {
        e.preventDefault();
        insertTaskItem(editor);
      }}
      title="Tâche"
    >
      ☑︎
    </ToolbarButton>
    <ToolbarButton
      onMouseDown={(e) => {
        e.preventDefault();
        indentTaskItem(editor);
      }}
      title="Indenter une tâche"
    >
      ↳
    </ToolbarButton>
    <ToolbarButton
      onMouseDown={(e) => {
        e.preventDefault();
        outdentTaskItem(editor);
      }}
      title="Désindenter une tâche"
    >
      ↰
    </ToolbarButton>
  </div>
);

const TaskItemElement = ({
  attributes,
  children,
  element,
}: {
  attributes: any;
  children: React.ReactNode;
  element: SlateElement & { checked?: boolean; collapsed?: boolean };
}) => {
  const editor = useSlateStatic();
  const path = (ReactEditor as any).findPath(editor, element as SlateElement);
  const hasChildren = element.children.some(
    (child) => SlateElement.isElement(child) && (child as SlateElement).type === 'task-list'
  );

  const childNodes = React.Children.toArray(children);
  const textChildren: React.ReactNode[] = [];
  const listChildren: React.ReactNode[] = [];
  element.children.forEach((child, index) => {
    if (SlateElement.isElement(child) && (child as SlateElement).type === 'task-list') {
      listChildren.push(childNodes[index]);
    } else {
      textChildren.push(childNodes[index]);
    }
  });

  return (
    <li
      {...attributes}
      className="task-item"
      data-collapsed={element.collapsed ? 'true' : 'false'}
      data-has-children={hasChildren ? 'true' : 'false'}
    >
      <div className="task-item-row">
        {hasChildren && (
          <button
            type="button"
            className="task-chevron"
            onMouseDown={(event) => {
              event.preventDefault();
              Transforms.setNodes(editor, { collapsed: !element.collapsed } as any, { at: path });
            }}
          >
            {element.collapsed ? '▸' : '▾'}
          </button>
        )}
        {!hasChildren && <span className="task-chevron task-chevron-placeholder" />}
        <input
          type="checkbox"
          checked={!!element.checked}
          onChange={() => {
            Transforms.setNodes(editor, { checked: !element.checked } as any, { at: path });
          }}
        />
        <div className={cn('task-item-content', element.checked && 'task-item-checked')}>
          {textChildren}
        </div>
      </div>
      {!element.collapsed && <div className="task-children">{listChildren}</div>}
    </li>
  );
};

const Element = (props: any) => {
  const { attributes, children, element } = props;
  switch (element.type) {
    case 'heading-one':
      return <h1 {...attributes}>{children}</h1>;
    case 'heading-two':
      return <h2 {...attributes}>{children}</h2>;
    case 'bulleted-list':
      return <ul {...attributes}>{children}</ul>;
    case 'numbered-list':
      return <ol {...attributes}>{children}</ol>;
    case 'list-item':
      return <li {...attributes}>{children}</li>;
    case 'task-list':
      return <ul {...attributes} className="task-list">{children}</ul>;
    case 'task-item':
      return <TaskItemElement {...props} element={element} />;
    default:
      return <p {...attributes}>{children}</p>;
  }
};

const Leaf = ({ attributes, children, leaf }: any) => {
  if (leaf.bold) children = <strong>{children}</strong>;
  if (leaf.italic) children = <em>{children}</em>;
  if (leaf.underline) children = <u>{children}</u>;
  return <span {...attributes}>{children}</span>;
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  className,
  showToolbar = true,
}) => {
  const editor = useMemo(() => withTasks(withHistory(withReact(createEditor()))), []);
  const [internalValue, setInternalValue] = useState<Descendant[]>(() => parseIncomingValue(value));
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    setInternalValue(parseIncomingValue(value));
    setEditorKey((prev) => prev + 1);
  }, [value]);

  const renderElement = useCallback((props: any) => <Element {...props} />, []);
  const renderLeaf = useCallback((props: any) => <Leaf {...props} />, []);

  return (
    <div className={cn('rte-container', className)}>
      <Slate
        key={editorKey}
        editor={editor}
        initialValue={internalValue}
        onChange={(nextValue) => {
          setInternalValue(nextValue);
          if (!readOnly) onChange(serializeValue(nextValue));
        }}
      >
        {!readOnly && showToolbar && <RichTextToolbar editor={editor} />}
        <Editable
          readOnly={readOnly}
          className={cn('rte-editor', readOnly && 'rte-readonly')}
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          placeholder="Écrire ici..."
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const entry = getTaskItemEntry(editor);
              if (entry) {
                event.preventDefault();
                const [, path] = entry as [SlateElement, Path];
                const nextPath = Path.next(path);
                const newItem = {
                  type: 'task-item',
                  checked: false,
                  collapsed: false,
                  children: [{ type: 'paragraph', children: [{ text: '' }] }],
                };
                Transforms.insertNodes(editor, newItem as any, { at: nextPath });
                Transforms.select(editor, nextPath.concat(0, 0));
                return;
              }
            }

            if (event.key === 'Backspace' || event.key === 'Delete') {
              const entry = getTaskItemEntry(editor);
              if (!entry) return;
              const [node, path] = entry as [SlateElement, Path];
              const text = Node.string(node);
              if (text.length === 0) {
                event.preventDefault();
                const listEntry = getTaskListEntry(editor, path);
                Transforms.setNodes(editor, { type: 'paragraph' } as any, { at: path });
                Transforms.liftNodes(editor, { at: path });
                if (listEntry) {
                  const [, listPath] = listEntry as [SlateElement, Path];
                  try {
                    const [listNode] = Editor.node(editor, listPath) as [SlateElement, Path];
                    if (listNode.children.length === 0) {
                      Transforms.removeNodes(editor, { at: listPath });
                    }
                  } catch {
                    // ignore stale path
                  }
                }
                return;
              }
            }

            if (event.key === 'Tab') {
              const entry = getTaskItemEntry(editor);
              if (!entry) return;
              event.preventDefault();
              if (event.shiftKey) outdentTaskItem(editor);
              else indentTaskItem(editor);
            }
          }}
        />
      </Slate>
    </div>
  );
};

export default RichTextEditor;

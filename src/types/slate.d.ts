import { BaseEditor, Descendant } from 'slate';
import { ReactEditor } from 'slate-react';
import { HistoryEditor } from 'slate-history';

type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

type ParagraphElement = { type: 'paragraph'; children: CustomText[] };

type HeadingOneElement = { type: 'heading-one'; children: CustomText[] };

type HeadingTwoElement = { type: 'heading-two'; children: CustomText[] };

type ListItemElement = { type: 'list-item'; children: Descendant[] };

type BulletedListElement = { type: 'bulleted-list'; children: ListItemElement[] };

type NumberedListElement = { type: 'numbered-list'; children: ListItemElement[] };

type TaskItemElement = {
  type: 'task-item';
  checked?: boolean;
  collapsed?: boolean;
  children: Descendant[];
};

type TaskListElement = { type: 'task-list'; children: TaskItemElement[] };

type CustomElement =
  | ParagraphElement
  | HeadingOneElement
  | HeadingTwoElement
  | ListItemElement
  | BulletedListElement
  | NumberedListElement
  | TaskListElement
  | TaskItemElement;

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

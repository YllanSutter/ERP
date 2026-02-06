import React from 'react';
import { cn } from '@/lib/utils';
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor';
import './rich-text-editor.css';

type RichTextEditorProps = {
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
  className?: string;
  showToolbar?: boolean;
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  className,
  showToolbar = true,
}) => {
  return (
    <div className={cn('rte-container', className)}>
      <SimpleEditor
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        showToolbar={showToolbar}
      />
    </div>
  );
};

export default RichTextEditor;

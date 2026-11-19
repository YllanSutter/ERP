import React from 'react';
import EditableProperty from './EditableProperty';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Props = React.ComponentProps<typeof EditableProperty> & { children: React.ReactNode };

/** Keep the compact card preview; mount the full editor only when requested. */
export default function EditableFieldPreview({ children, ...props }: Props) {
  const calculated = props.property.type === 'number' && (props.property.numberMode === 'calculated' || Boolean(props.property.calculation));
  if (props.readOnly || calculated) return <>{children}</>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div role="button" tabIndex={0} aria-label={`Modifier ${props.property.name}`}
          className="min-w-0 cursor-pointer"
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.currentTarget.click();
            }
          }}>
          <div className="pointer-events-none">{children}</div>
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-3"
        onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <div className="mb-2 text-xs font-medium text-muted-foreground">{props.property.name}</div>
        <EditableProperty {...props} disableNameLink forceRichEditor={props.property.type === 'rich_text'} />
      </PopoverContent>
    </Popover>
  );
}

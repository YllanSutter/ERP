import React from 'react';
import EditableProperty from './EditableProperty';
import { SelectPropertyField } from './SelectPropertyField';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Props = React.ComponentProps<typeof EditableProperty> & { children: React.ReactNode };

/** Keep the compact card preview; mount the full editor only when requested. */
export default function EditableFieldPreview({ children, ...props }: Props) {
  const calculated = props.property.type === 'number' && (props.property.numberMode === 'calculated' || Boolean(props.property.calculation));
  if (props.readOnly || calculated) return <>{children}</>;
  const trigger = (
    <div role="button" tabIndex={0} aria-label={`Modifier ${props.property.name}`}
          className="min-h-5 min-w-0 cursor-pointer"
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.currentTarget.click();
            }
          }}>
          <div className="pointer-events-none">{props.value == null || props.value === '' || (Array.isArray(props.value) && !props.value.length)
            ? <span className="text-muted-foreground">—</span> : children}</div>
        </div>
  );
  if (['select', 'multi_select', 'multiselect'].includes(props.property.type)) {
    const collectionId = props.collection?.id
      || props.collections?.find((candidate: any) => candidate.properties?.includes(props.property))?.id
      || props.currentItem?.__collectionId;
    return <SelectPropertyField property={props.property} collectionId={collectionId} value={props.value}
      onChange={props.onChange} trigger={trigger} />;
  }
  if (['date', 'relation'].includes(props.property.type)) {
    return <EditableProperty {...props} disableNameLink editorTrigger={trigger} />;
  }
  if (props.property.type !== 'rich_text') {
    return <div className="min-w-0" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
      onDragStart={event => { event.preventDefault(); event.stopPropagation(); }}>
      <EditableProperty {...props} disableNameLink />
    </div>;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-3"
        onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <div className="mb-2 text-xs font-medium text-muted-foreground">{props.property.name}</div>
        <EditableProperty {...props} disableNameLink forceRichEditor={props.property.type === 'rich_text'} />
      </PopoverContent>
    </Popover>
  );
}

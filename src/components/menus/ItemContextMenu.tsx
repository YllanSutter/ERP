import React, { useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuLabel, ContextMenuTrigger } from '@/components/ui/context-menu';
import EditableProperty from '@/components/fields/EditableProperty';
import ColorPicker from '@/components/inputs/ColorPicker';
import { SettingsDialog } from '@/components/ui/settings-panel';
import { Button } from '@/components/ui/button';
import { normalizeColor } from '@/lib/utils/colorUtils';

export interface ItemContextMenuProps {
  item: any;
  children: React.ReactNode;
  onViewDetail: (item: any) => void;
  onDelete?: (id: string) => void;
  canEdit: boolean;
  quickEditProperties?: any[];
  onEdit?: (item: any) => void;
  collections?: any[];
  onRelationChange?: (prop: any, item: any, value: any) => void;
  onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
  canEditField?: (fieldId: string) => boolean;
  triggerMode?: 'context' | 'button';
  extraActions?: Array<{ label: string; onSelect: () => void }>;
}

const ItemContextMenu: React.FC<ItemContextMenuProps> = ({
  item, children, onViewDetail, onDelete, canEdit, quickEditProperties = [], onEdit,
  collections = [], onRelationChange, onNavigateToCollection, canEditField, triggerMode = 'context', extraActions = [],
}) => {
  const [colorProperty, setColorProperty] = useState<any>(null);
  const isButton = triggerMode === 'button';
  const Root = isButton ? DropdownMenu.Root : ContextMenu;
  const Trigger = isButton ? DropdownMenu.Trigger : ContextMenuTrigger;
  const Item = isButton ? DropdownMenu.Item : ContextMenuItem;
  const Label = isButton ? DropdownMenu.Label : ContextMenuLabel;
  const Separator = isButton ? DropdownMenu.Separator : ContextMenuSeparator;
  const entryClass = 'flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
  const entries = <>
    <Item onSelect={() => onViewDetail(item)} className={entryClass}><Eye size={14} /><span>Détails</span></Item>
    {quickEditProperties.length > 0 && <>
      <Separator className="my-1 h-px bg-border" />
      <Label className="px-2 py-1 text-xs text-muted-foreground">Édition rapide</Label>
      {quickEditProperties.map((prop: any) => {
        const editable = canEdit && Boolean(onEdit) && (canEditField ? canEditField(prop.id) : false);
        // A portalled picker inside a menu row loses focus when the pointer leaves the row.
        // Open its editor outside the menu so dismissal and pointer handling stay independent.
        if (prop.type === 'color') return <Item key={prop.id} disabled={!editable} className={entryClass} onSelect={() => setColorProperty(prop)}>
          <span className="size-4 rounded border border-border" style={{ backgroundColor: normalizeColor(item[prop.id]) || 'transparent' }} />
          <span>{prop.name}</span>
        </Item>;
        return <Item key={prop.id} className={`${entryClass} justify-between gap-4 cursor-default`} onSelect={(event) => event.preventDefault()}>
          <span className="text-xs text-muted-foreground">{prop.name}:</span>
          <div className="max-w-[200px] flex-1" onClick={(event) => event.stopPropagation()}>
            {onEdit && <EditableProperty property={prop} value={item[prop.id]} onChange={(value) => onEdit({ ...item, [prop.id]: value })}
              size="sm" collections={collections} currentItem={item} onRelationChange={onRelationChange}
              onNavigateToCollection={onNavigateToCollection} readOnly={!editable} />}
          </div>
        </Item>;
      })}
    </>}
    {canEdit && (extraActions.length > 0 || onDelete) && <Separator className="my-1 h-px bg-border" />}
    {canEdit && extraActions.map((action) => <Item key={action.label} onSelect={action.onSelect} className={`${entryClass} text-destructive`}>{action.label}</Item>)}
    {canEdit && onDelete && <Item onSelect={() => onDelete(item.id)} className={`${entryClass} text-destructive`}><Trash2 size={14} /><span>Supprimer</span></Item>}
  </>;
  return <>
    <Root>
      <Trigger asChild>{children}</Trigger>
      {isButton ? <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={4} className="z-[401] min-w-[12rem] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">{entries}</DropdownMenu.Content></DropdownMenu.Portal>
        : <ContextMenuContent>{entries}</ContextMenuContent>}
    </Root>
    <SettingsDialog open={Boolean(colorProperty)} onOpenChange={(open) => { if (!open) setColorProperty(null); }} title={colorProperty?.name || 'Couleur'} layer={450}>
      {colorProperty && <>
        <ColorPicker value={item[colorProperty.id] || ''} onChange={(value) => onEdit?.({ ...item, [colorProperty.id]: value })} />
        <div className="border-t border-border p-2"><Button type="button" variant="ghost" size="sm" onClick={() => { onEdit?.({ ...item, [colorProperty.id]: null }); setColorProperty(null); }}>Effacer la couleur</Button></div>
      </>}
    </SettingsDialog>
  </>;
};

export default ItemContextMenu;

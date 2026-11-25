import React, { useState } from 'react';
import { Eye, Sparkles, Trash2 } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuLabel, ContextMenuTrigger } from '@/components/ui/context-menu';
import EditableProperty from '@/components/fields/EditableProperty';
import ColorPicker, { COLOR_PICKER_SURFACE_CLASS } from '@/components/inputs/ColorPicker';
import { SettingsDialog } from '@/components/ui/settings-panel';
import { Button } from '@/components/ui/button';
import { normalizeColor } from '@/lib/utils/colorUtils';
import { applyCollectionTemplateDateParts } from '@/lib/collectionTemplateDates';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface ItemContextMenuProps {
  item: any;
  children: React.ReactNode;
  onViewDetail: (item: any) => void;
  onDelete?: (id: string) => void;
  canEdit: boolean;
  quickEditProperties?: any[];
  onEdit?: (item: any) => void;
  collections?: any[];
  collection?: any;
  onRelationChange?: (prop: any, item: any, value: any) => void;
  onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
  canEditField?: (fieldId: string) => boolean;
  triggerMode?: 'context' | 'button';
  extraActions?: Array<{ label: string; onSelect: () => void }>;
}

const ItemContextMenu: React.FC<ItemContextMenuProps> = ({
  item, children, onViewDetail, onDelete, canEdit, quickEditProperties = [], onEdit,
  collections = [], collection, onRelationChange, onNavigateToCollection, canEditField, triggerMode = 'context', extraActions = [],
}) => {
  const [colorProperty, setColorProperty] = useState<any>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const activeCollection = collection || collections.find((candidate: any) => candidate.id === item?.__collectionId);
  const collectionTemplates = Array.isArray(activeCollection?.collectionTemplates) ? activeCollection.collectionTemplates : [];
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const isButton = triggerMode === 'button';
  const Root = isButton ? DropdownMenu.Root : ContextMenu;
  const Trigger = isButton ? DropdownMenu.Trigger : ContextMenuTrigger;
  const Item = isButton ? DropdownMenu.Item : ContextMenuItem;
  const Label = isButton ? DropdownMenu.Label : ContextMenuLabel;
  const Separator = isButton ? DropdownMenu.Separator : ContextMenuSeparator;
  const entryClass = 'flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
  const entries = <>
    <Item onSelect={() => onViewDetail(item)} className={entryClass}><Eye size={14} /><span>Détails</span></Item>
    {canEdit && onEdit && collectionTemplates.some((template: any) => template?.fieldIds?.length) && <>
      <Separator className="my-1 h-px bg-border" />
      <Item onSelect={() => {
        setSelectedTemplateId(collectionTemplates.find((template: any) => template?.fieldIds?.length)?.id || '');
        setTemplateDialogOpen(true);
      }} className={entryClass}><Sparkles size={14} /><span>Appliquer un template…</span></Item>
    </>}
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
    {canEdit && onDelete && <Item onSelect={() => onDelete(item.id)} className={`${entryClass} text-destructive`}><Trash2 size={14} /><span>Archiver</span></Item>}
  </>;
  return <>
    <Root>
      <Trigger asChild>{children}</Trigger>
      {isButton ? <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={4} className="z-[150] min-w-[12rem] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">{entries}</DropdownMenu.Content></DropdownMenu.Portal>
        : <ContextMenuContent>{entries}</ContextMenuContent>}
    </Root>
    <SettingsDialog open={Boolean(colorProperty)} onOpenChange={(open) => { if (!open) setColorProperty(null); }} title={colorProperty?.name || 'Couleur'} className={COLOR_PICKER_SURFACE_CLASS} layer={450}>
      {colorProperty && <>
        <ColorPicker value={item[colorProperty.id] || ''} onChange={(value) => onEdit?.({ ...item, [colorProperty.id]: value })} />
        <div className="border-t border-border p-2"><Button type="button" variant="ghost" size="sm" onClick={() => { onEdit?.({ ...item, [colorProperty.id]: null }); setColorProperty(null); }}>Effacer la couleur</Button></div>
      </>}
    </SettingsDialog>
    <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appliquer un template à « {item?.name || item?.title || 'cet élément'} » ?</DialogTitle>
          <DialogDescription>Choisis un template, puis confirme pour remplacer les valeurs correspondantes de cet item.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[45vh] space-y-2 overflow-y-auto">
          {collectionTemplates.filter((template: any) => template?.fieldIds?.length).map((template: any, index: number) => {
            const names = template.fieldIds.map((id: string) => activeCollection?.properties?.find((prop: any) => prop.id === id)?.name).filter(Boolean);
            return (
              <label key={template.id || index} className={`block cursor-pointer rounded-lg border p-3 ${selectedTemplateId === template.id ? 'border-brand-500 bg-brand-500/5' : 'border-border'}`}>
                <span className="flex items-start gap-3">
                  <input type="radio" name={`item-template-${item?.id}`} className="mt-1" value={template.id} checked={selectedTemplateId === template.id} onChange={() => setSelectedTemplateId(template.id)} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{template.name?.trim() || `Template ${index + 1}`}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{names.join(' · ') || 'Aucun champ'}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => setTemplateDialogOpen(false)}>Annuler</Button>
          <Button type="button" disabled={!selectedTemplateId} onClick={() => {
            const template = collectionTemplates.find((candidate: any) => candidate.id === selectedTemplateId);
            if (!template) return;
            const updates = template.values && typeof template.values === 'object' ? template.values : {};
            const nextItem = { ...item, collectionTemplateId: template.id };
            template.fieldIds.forEach((fieldId: string) => {
              const prop = activeCollection?.properties?.find((candidate: any) => candidate.id === fieldId);
              if (!prop) return;
              if (prop.type === 'date' && Object.prototype.hasOwnProperty.call(template.dateDefaults || {}, prop.id)) {
                Object.assign(nextItem, applyCollectionTemplateDateParts(nextItem, prop.id, template.dateDefaults[prop.id]));
                return;
              }
              if (Object.prototype.hasOwnProperty.call(updates, fieldId) && updates[fieldId] !== '') {
                let value: any = updates[fieldId];
                if (prop.type === 'number') value = Number(value);
                else if (prop.type === 'checkbox' || prop.type === 'boolean') value = value === true || String(value).toLowerCase() === 'true';
                else if (['multiselect', 'multi_select'].includes(prop.type)) value = Array.isArray(value) ? value : String(value).split(',').map((part: string) => part.trim()).filter(Boolean);
                else if (prop.type === 'date' && value === 'current_date') value = new Date().toISOString();
                nextItem[fieldId] = value;
              }
              const durationKey = `${fieldId}_duration`;
              if (prop.type === 'date' && Object.prototype.hasOwnProperty.call(updates, durationKey) && updates[durationKey] !== '') {
                nextItem[durationKey] = Number(updates[durationKey]);
              }
            });
            onEdit?.(nextItem);
            setTemplateDialogOpen(false);
          }}>Valider et appliquer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
};

export default ItemContextMenu;

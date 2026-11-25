import { steamExchanges, steamExchangeLabelValue, steamGameName } from '@/lib/plugins/steam/exchanges';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Check, GripVertical } from 'lucide-react';
import EditableProperty from '@/components/fields/EditableProperty';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '@/components/ui/context-menu';
import { Item, Property, Collection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface TableItemRowProps {
  item: Item;
  isFavorite?: boolean;
  visibleProperties: Property[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onToggleFavoriteItem?: (itemId: string) => void;
  onViewDetail: (item: Item, section?: 'steam-exchange' | 'cancel-steam-exchange') => void;
  collections: Collection[];
  onRelationChange: (prop: Property, item: Item, value: any) => void;
  onNavigateToCollection: (collectionId: string, linkedIds?: string[]) => void;
  canEdit: boolean;
  canEditField: (fieldId: string) => boolean;
  paddingLeft?: number;
  animate?: boolean;
  collection?: any;
  enableSelection?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (itemId: string, checked: boolean) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  enableDragReorder?: boolean;
  onDragStart?: (itemId: string) => void;
  onDragEnter?: (itemId: string) => void;
  onDrop?: (itemId: string, e: React.DragEvent<HTMLTableRowElement>) => void;
  onDragEnd?: () => void;
}

const TableItemRow: React.FC<TableItemRowProps> = ({
  item,
  isFavorite = false,
  visibleProperties,
  onEdit,
  onDelete,
  onToggleFavoriteItem,
  onViewDetail,
  collections,
  onRelationChange,
  onNavigateToCollection,
  canEdit,
  canEditField,
  collection,
  paddingLeft = 16,
  animate = true,
  enableSelection = false,
  isSelected = false,
  onSelectionChange,
  isDragging = false,
  isDragOver = false,
  enableDragReorder = false,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}) => {
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const collectionTemplates = Array.isArray(collection?.collectionTemplates) ? collection.collectionTemplates.filter((template: any) => Array.isArray(template.fieldIds) && template.fieldIds.length > 0) : [];
  const RowComponent = animate ? motion.tr : 'tr';
  const motionProps = animate
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
      }
    : {};

  const handleDragHandleStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/x-erp-table-row', item.id);
    event.dataTransfer.effectAllowed = 'move';
    onDragStart?.(item.id);
  };

  const handleDragOver = (event: React.DragEvent<HTMLTableRowElement>) => {
    if (!onDragStart || !event.dataTransfer.types.includes('application/x-erp-table-row')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    onDragEnter?.(item.id);
  };

  const resolveDisplayValueForLinkedColumn = (prop: any) => {
    if (!prop?.isRelationLinkedColumn || !prop?.sourceRelationPropertyId || !prop?.sourceDisplayFieldId) {
      return item[prop.id];
    }

    const sourceRelationValue = item[prop.sourceRelationPropertyId];
    const relatedIds = Array.isArray(sourceRelationValue)
      ? sourceRelationValue
      : sourceRelationValue
        ? [sourceRelationValue]
        : [];

    if (!relatedIds.length) return null;

    const targetCollection = collections.find((c: any) => c.id === prop.sourceTargetCollectionId)
      || collections.find((c: any) => c.id === (collection?.properties || []).find((p: any) => p.id === prop.sourceRelationPropertyId)?.relation?.targetCollectionId);
    const targetItems = targetCollection?.items || [];

    const rawValues = relatedIds
      .map((id: string) => targetItems.find((it: any) => it.id === id)?.[prop.sourceDisplayFieldId])
      .filter((v: any) => v !== undefined && v !== null && v !== '');

    if (!rawValues.length) return null;

    if (prop.type === 'multi_select') {
      const flattened = rawValues.flatMap((v: any) => Array.isArray(v) ? v : [v]);
      return Array.from(new Set(flattened));
    }

    if (prop.type === 'checkbox') {
      return rawValues.some(Boolean);
    }

    return rawValues[0];
  };

  // Propriétés à afficher dans le menu contextuel
  const contextMenuProperties = visibleProperties.filter((p: any) => !p.isRelationLinkedColumn && p.showContextMenu && canEditField(p.id));

  // Propriétés à afficher dans la vue (excluant celles du menu contextuel)
  const displayProperties = visibleProperties.filter((p: any) => !p.showContextMenu);

  const exchange = steamExchanges(collection);
  const exchangeParent = exchange.parents.get(item.id);
  const exchanged = exchange.children.has(item.id);
  const gameColumn = displayProperties.find((property) =>
    !property.isRelationLinkedColumn && (property.id === 'name' || property.name === 'Nom'),
  ) ?? displayProperties.find((property) => !property.isRelationLinkedColumn && property.type === 'steam') ?? displayProperties[0];
  const exchangeParentName = exchangeParent && steamGameName(collection, exchangeParent);

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <RowComponent
          {...motionProps}
          onDragOver={onDragStart ? handleDragOver : undefined}
          onDrop={onDragStart ? (event) => onDrop?.(item.id, event) : undefined}
          onDragEnd={onDragEnd}
          className={`hover:bg-white/5 transition-colors border-b border-black/5 dark:border-white/5 cursor-context-menu leading-tight ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'outline outline-1 outline-brand-500/60' : ''}`}
        >
          {enableDragReorder && (
            <td className="px-1 py-1 text-center align-middle w-8">
              <div
                draggable={Boolean(onDragStart)}
                onDragStart={onDragStart ? handleDragHandleStart : undefined}
                className={`inline-flex items-center justify-center ${onDragStart ? 'cursor-grab active:cursor-grabbing hover:text-brand-400 transition-colors' : 'cursor-not-allowed opacity-40'}`}
                title={onDragStart ? 'Glisser pour réorganiser' : 'Sélectionner Ordre manuel dans l’en-tête pour déplacer les lignes'}
              >
                <GripVertical size={14} />
              </div>
            </td>
          )}
          {enableSelection && (
            <td className="px-2 py-1 text-center align-middle">
              <label
                className="inline-flex items-center justify-center cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onSelectionChange?.(item.id, e.target.checked)}
                  className="sr-only peer"
                  aria-label={`Sélectionner ${item.name || item.id}`}
                />
                <span className="h-4 w-4 rounded-md border border-black/20 dark:border-white/20 bg-white/80 dark:bg-neutral-800 shadow-sm transition-colors peer-checked:bg-brand-500 peer-checked:border-brand-500 flex items-center justify-center">
                  {isSelected && <Check size={12} className="text-white" />}
                </span>
              </label>
            </td>
          )}
          {displayProperties.map((prop: any) => {
            const isLinkedRelationColumn = Boolean(prop?.isRelationLinkedColumn && prop?.sourceRelationPropertyId);
            const effectiveProperty = prop;
            const rawValue = resolveDisplayValueForLinkedColumn(prop);
            const exchangeLabel = isLinkedRelationColumn ? undefined : steamExchangeLabelValue(collection, prop, rawValue, exchanged, Boolean(exchangeParent));
            const effectiveValue = exchangeLabel ?? rawValue;
            const permissionFieldId = isLinkedRelationColumn ? prop.sourceRelationPropertyId : effectiveProperty.id;
            const canEditEffectiveField = canEditField(permissionFieldId);
            const showExchangeBranch = prop.id === gameColumn?.id && Boolean(exchangeParent);
            const showExchangeOrigin = prop.id === gameColumn?.id && exchanged && !exchangeParent;

            return (
            <td
              key={prop.id}
              className="px-4 py-1 whitespace-nowrap text-xs text-neutral-700 dark:text-neutral-300 relative user-select-auto"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {showExchangeOrigin && (
                <span className="pointer-events-none absolute bottom-0 left-1.5 top-1/2 w-px bg-brand-500/60" aria-hidden="true">
                  <span className="absolute -left-0.5 -top-0.5 size-1.5 rounded-full bg-brand-500" />
                </span>
              )}
              {showExchangeBranch && (
                <span
                  className="absolute left-1.5 top-0 h-1/2 w-4 rounded-bl-md border-b border-l border-brand-500/60"
                  role="img"
                  aria-label={`Reçu en échange de ${exchangeParentName}`}
                  title={`Reçu en échange de ${exchangeParentName}`}
                />
              )}
              <div className={showExchangeBranch ? 'pl-3' : undefined}>
              <EditableProperty
                property={effectiveProperty}
                value={effectiveValue}
                onChange={(val) => {
                  if (isLinkedRelationColumn || exchangeLabel !== undefined) return;
                  // Pas de recalcul côté client - le serveur le fera
                  const updated = { ...item, [effectiveProperty.id]: val };
                  onEdit(updated);
                }}
                size="md"
                isNameField={effectiveProperty.id === 'name' || effectiveProperty.name === 'Nom'}
                onViewDetail={effectiveProperty.id === 'name' || effectiveProperty.name === 'Nom' ? () => onViewDetail(item) : undefined}
                disableNameLink={true}
                collections={collections}
                currentItem={item}
                onRelationChange={onRelationChange}
                onNavigateToCollection={onNavigateToCollection}
                readOnly={isLinkedRelationColumn || exchangeLabel !== undefined || !canEdit || !canEditEffectiveField}
                collection={collection}
              />
              </div>
            </td>
            );
          })}
         
        </RowComponent>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem >
          <div className="flex justify-between w-full">
            <div className="left flex items-center" onClick={() => onViewDetail(item)}>
              <Icons.Search size={14} className="mr-2" />
              <span>Détails</span>
            </div>
            {canEdit && (
              <div className="px-6 py-2 whitespace-nowrap text-right text-sm">
                <div className="flex items-center justify-end gap-3 text-neutral-500">
                  <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-400">
                    <Icons.Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </ContextMenuItem>
        {canEdit && collectionTemplates.length > 0 && (
          <ContextMenuItem onSelect={() => {
            setSelectedTemplateId(collectionTemplates[0]?.id || '');
            setTemplateDialogOpen(true);
          }}>
            <Icons.Sparkles size={14} className="mr-2" />
            <span>Appliquer un template…</span>
          </ContextMenuItem>
        )}
        {canEdit && collection.plugins?.steam?.role === 'games' && (
          <ContextMenuItem onSelect={() => onViewDetail(item, 'steam-exchange')}>
            <Icons.ArrowRightLeft size={14} className="mr-2" />
            <span>{exchanged ? 'Modifier l’échange Steam' : 'Échanger ce jeu'}</span>
          </ContextMenuItem>
        )}
        {canEdit && (exchangeParent || exchanged) && (
          <ContextMenuItem onSelect={() => onViewDetail(item, 'cancel-steam-exchange')}>
            <Icons.Undo2 size={14} className="mr-2" />
            <span>Annuler l’échange</span>
          </ContextMenuItem>
        )}
        {onToggleFavoriteItem && (
          <ContextMenuItem onClick={() => onToggleFavoriteItem(item.id)}>
            <Icons.Star size={14} className={`mr-2 ${isFavorite ? 'text-brand-500 fill-current' : ''}`} />
            <span>{isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
          </ContextMenuItem>
        )}
        {contextMenuProperties.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuLabel className="text-xs">Édition rapide</ContextMenuLabel>
            <ContextMenuSeparator />
            {contextMenuProperties.map((prop: any) => {
              const effectiveProperty = prop;
              const exchangeLabel = steamExchangeLabelValue(collection, prop, item[prop.id], exchanged, Boolean(exchangeParent));
              const effectiveValue = exchangeLabel ?? item[prop.id];

              return (
                <div key={prop.id} role="group" aria-label={`Modifier ${prop.name}`}
                  className={prop.type === 'rich_text' ? "flex flex-col gap-1 px-2 py-1.5 cursor-default" : "flex items-start justify-between gap-4 px-2 py-1.5 cursor-default"}
                  onKeyDown={(event) => { if (event.key !== 'Escape') event.stopPropagation(); }}
                  onPointerMove={(event) => event.stopPropagation()}>
                  <span className="text-xs text-neutral-400">{prop.name}:</span>
                  <div className={prop.type === 'rich_text' ? "w-[min(32rem,calc(100vw-3rem))]" : "flex-1 max-w-[200px]"} onClick={(e) => e.stopPropagation()}>
                    <EditableProperty
                      property={effectiveProperty}
                      forceRichEditor={prop.type === 'rich_text'}
                      className={prop.type === 'rich_text' ? 'context-rich-editor' : undefined}
                      value={effectiveValue}
                      onChange={(val) => {
                        if (exchangeLabel !== undefined) return;
                        // Pas de recalcul côté client - le serveur le fera
                        const updated = { ...item, [effectiveProperty.id]: val };
                        onEdit(updated);
                      }}
                      size="sm"
                      collections={collections}
                      currentItem={item}
                      onRelationChange={onRelationChange}
                      onNavigateToCollection={onNavigateToCollection}
                      readOnly={exchangeLabel !== undefined}
                      collection={collection}
                    />
                  </div>
                </div>
              );
            })}
            
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
    <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appliquer un template à « {item.name || item.id} » ?</DialogTitle>
          <DialogDescription>Choisis un template, puis confirme pour remplacer les valeurs correspondantes de cet item.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[45vh] space-y-2 overflow-y-auto">
          {collectionTemplates.map((template: any, index: number) => {
            const names = template.fieldIds.map((id: string) => collection?.properties?.find((prop: any) => prop.id === id)?.name).filter(Boolean);
            return (
              <label key={template.id || index} className={`block cursor-pointer rounded-lg border p-3 ${selectedTemplateId === template.id ? 'border-brand-500 bg-brand-500/5' : 'border-border'}`}>
                <span className="flex items-start gap-3">
                  <input type="radio" name={`table-item-template-${item.id}`} className="mt-1" value={template.id} checked={selectedTemplateId === template.id} onChange={() => setSelectedTemplateId(template.id)} />
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
            const values = template.values && typeof template.values === 'object' ? template.values : {};
            const updated = { ...item } as Record<string, any>;
            template.fieldIds.forEach((fieldId: string) => {
              const prop = collection?.properties?.find((candidate: any) => candidate.id === fieldId);
              if (!prop || !Object.prototype.hasOwnProperty.call(values, fieldId) || values[fieldId] === '') return;
              let value: any = values[fieldId];
              if (prop.type === 'number') value = Number(value);
              else if (prop.type === 'checkbox' || prop.type === 'boolean') value = value === true || String(value).toLowerCase() === 'true';
              else if (['multiselect', 'multi_select'].includes(prop.type)) value = Array.isArray(value) ? value : String(value).split(',').map((part: string) => part.trim()).filter(Boolean);
              else if (prop.type === 'date' && value === 'current_date') value = new Date().toISOString();
              updated[fieldId] = value;
            });
            onEdit(updated as Item);
            setTemplateDialogOpen(false);
          }}>Valider et appliquer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default React.memo(TableItemRow);

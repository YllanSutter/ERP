import React from 'react';
import EditableProperty from '@/components/fields/EditableProperty';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, Trash2, X } from 'lucide-react';

interface BulkSelectionToolbarProps {
  count: number;
  properties: any[];
  fieldId: string;
  value: any;
  collection: any;
  collections: any[];
  onFieldChange: (fieldId: string) => void;
  onValueChange: (value: any) => void;
  onApply: () => void;
  onClear: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  deleteDialogOpen: boolean;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onBulkImportItad?: () => void;
  onSelectAll?: (checked: boolean) => void;
  allSelected?: boolean;
  selectionTotal?: number;
}

export const BulkSelectionToolbar: React.FC<BulkSelectionToolbarProps> = ({
  count, properties, fieldId, value, collection, collections, onFieldChange, onValueChange,
  onApply, onClear, onDelete, onConfirmDelete, deleteDialogOpen, onDeleteDialogOpenChange, onBulkImportItad,
  onSelectAll, allSelected = false, selectionTotal = 0,
}) => {
  const property = properties.find((candidate) => candidate.id === fieldId);
  if (!count && !onSelectAll) return null;

  return <>
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto border-b border-black/10 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-black/20">
      {onSelectAll && <label className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10">
        <Checkbox aria-label="Sélectionner tous les éléments" checked={allSelected} indeterminate={count > 0 && !allSelected} onChange={(event) => onSelectAll(event.target.checked)} />
        <span>{allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}</span>
        <span className="text-muted-foreground/70">{selectionTotal}</span>
      </label>}
      {count > 0 && <>
        <span className="shrink-0 text-xs text-neutral-600 dark:text-neutral-300">{count} sélectionné{count > 1 ? 's' : ''}</span>
        <Select value={fieldId} onValueChange={onFieldChange} disabled={!properties.length}>
          <SelectTrigger className="h-8 w-40 shrink-0 text-xs"><SelectValue placeholder="Champ à modifier" /></SelectTrigger>
          <SelectContent>{properties.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="min-w-[220px] shrink-0">
          {property ? <EditableProperty key={`bulk-${property.id}-${property.type}`} property={property} value={value} onChange={onValueChange} size="sm" readOnly={!fieldId} collections={collections} collection={collection} currentItem={{ id: 'bulk-editor', [property.id]: value }} onRelationChange={(changed, _item, nextValue) => { if (changed.id === property.id) onValueChange(nextValue); }} /> : <Input className="h-8 text-xs" disabled placeholder="Valeur à appliquer" />}
        </div>
        <div className="min-w-2 flex-1" />
        <Button type="button" className="h-8 w-8 shrink-0" variant="secondary" size="icon" disabled={!fieldId} onClick={onApply} aria-label="Appliquer" title="Appliquer"><Check /></Button>
        {onBulkImportItad && <Button type="button" className="shrink-0" variant="secondary" size="sm" onClick={onBulkImportItad}>⬇️ Importer ITAD ({count})</Button>}
        <Button type="button" className="h-8 w-8 shrink-0" variant="outline" size="icon" onClick={onClear} aria-label="Désélectionner" title="Désélectionner"><X /></Button>
        <Button type="button" className="h-8 w-8 shrink-0" variant="destructive" size="icon" onClick={onDelete} aria-label="Supprimer la sélection" title="Supprimer la sélection"><Trash2 /></Button>
      </>}
    </div>
    <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteDialogOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer la sélection ?</AlertDialogTitle>
          <AlertDialogDescription>Cette action supprimera définitivement {count} élément{count > 1 ? 's' : ''}.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={onConfirmDelete}>Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
};

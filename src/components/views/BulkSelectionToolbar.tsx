import React from 'react';
import EditableProperty from '@/components/fields/EditableProperty';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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
}

export const BulkSelectionToolbar: React.FC<BulkSelectionToolbarProps> = ({
  count, properties, fieldId, value, collection, collections, onFieldChange, onValueChange,
  onApply, onClear, onDelete, onConfirmDelete, deleteDialogOpen, onDeleteDialogOpenChange, onBulkImportItad,
}) => {
  const property = properties.find((candidate) => candidate.id === fieldId);
  return <>
    <div className="flex flex-wrap items-center gap-2 border-b border-black/10 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-black/20">
      <span className="text-xs text-neutral-600 dark:text-neutral-300">{count} sélectionné{count > 1 ? 's' : ''}</span>
      <Select value={fieldId} onValueChange={onFieldChange} disabled={!properties.length}>
        <SelectTrigger className="h-8 min-w-40 text-xs"><SelectValue placeholder="Champ à modifier" /></SelectTrigger>
        <SelectContent>{properties.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>)}</SelectContent>
      </Select>
      <div className="min-w-[220px]">
        {property ? <EditableProperty key={`bulk-${property.id}-${property.type}`} property={property} value={value} onChange={onValueChange} size="sm" readOnly={!fieldId} collections={collections} collection={collection} currentItem={{ id: 'bulk-editor', [property.id]: value }} onRelationChange={(changed, _item, nextValue) => { if (changed.id === property.id) onValueChange(nextValue); }} /> : <Input className="h-8 text-xs" disabled placeholder="Valeur à appliquer" />}
      </div>
      <Button type="button" variant="secondary" size="sm" disabled={!count || !fieldId} onClick={onApply}>Appliquer</Button>
      {onBulkImportItad && <Button type="button" variant="secondary" size="sm" disabled={!count} onClick={onBulkImportItad}>⬇️ Importer ITAD ({count})</Button>}
      <Button type="button" variant="outline" size="sm" disabled={!count} onClick={onClear}>Désélectionner</Button>
      <Button type="button" variant="destructive" size="sm" disabled={!count} onClick={onDelete}>Supprimer la sélection</Button>
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

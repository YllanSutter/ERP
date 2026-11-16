import { useState } from 'react';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { isArchivedItem } from '@/lib/itemArchive';

export default function ItemArchives({ collection, canEdit, onRestore, onDelete }: {
  collection: any; canEdit: boolean;
  onRestore: (id: string, collectionId: string) => void;
  onDelete: (id: string, collectionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const items = (collection.items || []).filter(isArchivedItem);
  const titleProperty = (collection.properties || []).find((property: any) => property.isTitle)
    || (collection.properties || []).find((property: any) => property.type === 'text');
  return <>
    <div className="flex justify-end px-4 pt-2">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Archive className="mr-2 h-4 w-4" />Archives ({items.length})</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Archives — {collection.name}</DialogTitle>
          <DialogDescription>Les éléments archivés sont conservés avec leurs données et leurs liens. Vous pouvez les restaurer ou les supprimer définitivement.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {!items.length && <p className="py-8 text-center text-sm text-muted-foreground">Aucun élément archivé.</p>}
          {items.map((item: any) => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{String(item[titleProperty?.id] || item.name || item.title || item.id)}</p><p className="text-xs text-muted-foreground">Archivé le {new Date(item._archivedAt).toLocaleString('fr-FR')}</p></div>
            {canEdit && <><Button variant="outline" size="sm" onClick={() => onRestore(item.id, collection.id)}><RotateCcw className="mr-2 h-4 w-4" />Restaurer</Button><Button variant="destructive" size="sm" onClick={() => setPending(item.id)}><Trash2 className="mr-2 h-4 w-4" />Supprimer définitivement</Button></>}
          </div>)}
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={pending !== null} onOpenChange={(value) => { if (!value) setPending(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Supprimer définitivement cet élément ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible. Ses données et les liens vers cet élément seront supprimés.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => { if (pending && canEdit) onDelete(pending, collection.id); setPending(null); }}>Supprimer définitivement</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}

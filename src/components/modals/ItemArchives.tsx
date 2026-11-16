import { useMemo, useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RotateCcw, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { ARCHIVE_PAGE_SIZE, getArchiveItemTitle, getArchivePage, type ArchiveSort } from '@/lib/itemArchive';

const archiveDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export default function ItemArchives({ collection, canEdit, onRestore, onDelete }: {
  collection: any; canEdit: boolean;
  onRestore: (id: string, collectionId: string) => void;
  onDelete: (id: string, collectionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ArchiveSort>('newest');
  const [requestedPage, setPage] = useState(1);
  const result = useMemo(() => getArchivePage(collection, query, sort, requestedPage), [collection, query, sort, requestedPage]);
  const pendingItem = pending ? collection.items?.find((item: any) => item.id === pending) : null;
  const pendingTitle = pendingItem ? getArchiveItemTitle(collection, pendingItem) : '';
  return <>
    <div className="flex justify-end px-4 pt-2">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Archive className="h-4 w-4" />Archives ({result.total})</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 px-5 pb-4 pt-6 text-left sm:px-6">
          <DialogTitle className="pr-8">Archives — {collection.name}</DialogTitle>
          <DialogDescription>Les données et les liens sont conservés jusqu’à la restauration ou la suppression définitive.</DialogDescription>
        </DialogHeader>
        <div className="flex shrink-0 flex-col gap-3 border-y border-border bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:px-6">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" aria-label="Rechercher dans les archives" placeholder="Rechercher par nom ou identifiant…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="bg-background pl-9" />
          </div>
          <Select value={sort} onValueChange={(value: ArchiveSort) => { setSort(value); setPage(1); }}>
            <SelectTrigger aria-label="Trier les archives" className="w-full bg-background sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[350]">
              <SelectItem value="newest">Plus récents d’abord</SelectItem>
              <SelectItem value="oldest">Plus anciens d’abord</SelectItem>
              <SelectItem value="name">Nom : A à Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground sm:px-6" aria-live="polite" role="status">
          <span>{result.filteredTotal} {result.filteredTotal > 1 ? 'éléments' : 'élément'}{query.trim() ? ` sur ${result.total}` : ' dans les archives'}</span>
          <span>{ARCHIVE_PAGE_SIZE} par page</span>
        </div>
        <div key={`${query}:${sort}:${result.page}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-y border-border">
          {result.items.length ? <ul aria-label="Éléments archivés" className="divide-y divide-border">
            {result.items.map(({ item, title }: { item: any; title: string }) => <li key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={title}>{title}</p>
                <p className="mt-1 text-xs text-muted-foreground"><time dateTime={item._archivedAt}>Archivé le {archiveDate.format(new Date(item._archivedAt))}</time></p>
              </div>
              {canEdit && <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <Button variant="outline" size="sm" aria-label={`Restaurer « ${title} »`} title="Restaurer cet élément" onClick={() => { setPage(result.page); onRestore(item.id, collection.id); }}><RotateCcw /><span className="hidden sm:inline">Restaurer</span></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Supprimer définitivement « ${title} »`} title="Supprimer définitivement" onClick={() => setPending(item.id)}><Trash2 /></Button>
              </div>}
            </li>)}
          </ul> : <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            {result.total ? <><Search className="h-7 w-7 text-muted-foreground" /><p className="text-sm font-medium">Aucun résultat pour cette recherche</p><Button variant="outline" size="sm" onClick={() => { setQuery(''); setPage(1); }}>Effacer la recherche</Button></> : <><Archive className="h-7 w-7 text-muted-foreground" /><p className="text-sm font-medium">Aucun élément archivé</p><p className="max-w-sm text-sm text-muted-foreground">Les éléments que vous archivez apparaîtront ici.</p></>}
          </div>}
        </div>
        <nav aria-label="Pagination des archives" className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <p className="text-xs tabular-nums text-muted-foreground">{result.first}–{result.last} sur {result.filteredTotal}</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Première page" disabled={result.page === 1} onClick={() => setPage(1)}><ChevronsLeft /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Page précédente" disabled={result.page === 1} onClick={() => setPage(result.page - 1)}><ChevronLeft /></Button>
            <span className="px-2 text-xs tabular-nums">{result.page} / {result.pageCount}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Page suivante" disabled={result.page === result.pageCount} onClick={() => setPage(result.page + 1)}><ChevronRight /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Dernière page" disabled={result.page === result.pageCount} onClick={() => setPage(result.pageCount)}><ChevronsRight /></Button>
          </div>
        </nav>
      </DialogContent>
    </Dialog>
    <AlertDialog open={pending !== null} onOpenChange={(value) => { if (!value) setPending(null); }}>
      <AlertDialogContent className="z-[401]" overlayClassName="z-[400]">
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer définitivement cet élément ?</AlertDialogTitle>
          <AlertDialogDescription><span className="block break-words font-medium text-foreground">{pendingTitle}</span>Cette action est irréversible. Ses données et les liens vers cet élément seront supprimés.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (pending && canEdit) { setPage(result.page); onDelete(pending, collection.id); } setPending(null); }}>Supprimer définitivement</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}

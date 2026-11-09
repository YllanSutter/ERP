import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCanEdit, useCanEditFields } from '@/lib/hooks/useCanEdit';
import type { Collection, Item } from '@/lib/types';
import { SteamExchangeEditor } from './SteamExchangeEditor';
import { canReceiveSteamGame, createSteamExchangeDraft, steamExchanges, steamGameName } from './exchanges';

export function SteamExchangeDialog({ collection, item, bundleField, cancelOnly = false, receivedId, onClose, onSave }: {
  collection: Collection;
  item: Item;
  bundleField: string;
  cancelOnly?: boolean;
  receivedId?: string;
  onClose: () => void;
  onSave: (ids: string[], drafts: Item[]) => void;
}) {
  const canEdit = useCanEdit(collection.id);
  const canEditField = useCanEditFields(collection.id);
  const graph = steamExchanges(collection);
  const [initialIds] = useState(() => (graph.children.get(item.id) || []).map((game) => game.id));
  const [ids, setIds] = useState(() => {
    if (!cancelOnly) return initialIds;
    return receivedId ? initialIds.filter((id) => id !== receivedId) : [];
  });
  const received = receivedId ? collection.items.find((game) => game.id === receivedId) : undefined;
  const [drafts, setDrafts] = useState<Item[]>([]);
  const [error, setError] = useState('');
  const editorCollection = { ...collection, items: [...collection.items, ...drafts] };
  const canCreate = canEdit && collection.properties.some((property) => property.type === 'steam' && canEditField(property.id));

  const save = () => {
    const currentIds = (graph.children.get(item.id) || []).map((game) => game.id);
    if (JSON.stringify(currentIds) !== JSON.stringify(initialIds)) {
      setError('Cet échange a été modifié. Rouvre la fenêtre pour afficher sa dernière version.');
      return;
    }
    if (ids.some((id) => {
      const candidate = editorCollection.items.find((game) => game.id === id);
      return !candidate || !canReceiveSteamGame(item, candidate, graph);
    })) {
      setError('Un jeu sélectionné est devenu indisponible. Vérifie la liste des jeux reçus.');
      return;
    }
    onSave(ids, drafts.filter((draft) => ids.includes(draft.id)));
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={`max-h-[90dvh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl p-4 sm:p-6 ${cancelOnly ? 'max-w-md' : 'max-w-3xl'}`}>
        <DialogHeader className="pr-7 text-left">
          <DialogTitle>{cancelOnly ? 'Annuler l’échange' : initialIds.length ? 'Modifier l’échange Steam' : 'Échanger ce jeu'}</DialogTitle>
          <DialogDescription>
            {received
              ? `« ${steamGameName(collection, received)} » sera retiré de l’échange. Sa fiche sera conservée.`
              : cancelOnly
                ? `L’échange de « ${steamGameName(collection, item)} » sera annulé. Les fiches des jeux reçus seront conservées.`
                : 'Ajoute les jeux reçus, puis enregistre l’échange.'}
          </DialogDescription>
        </DialogHeader>
        {!cancelOnly && <SteamExchangeEditor
          collection={editorCollection}
          item={item}
          receivedIds={ids}
          bundleRelationPropertyId={bundleField}
          standalone
          onChange={canEdit ? setIds : undefined}
          onCreate={canCreate ? (game) => {
            const draft = createSteamExchangeDraft(collection, item, game, bundleField, canEditField);
            if (!draft) return;
            setDrafts((previous) => [...previous, draft]);
            setIds((previous) => [...previous, draft.id]);
          } : undefined}
        />}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2 border-t border-border pt-4 sm:space-x-0">
          <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
          <Button type="button" disabled={!canEdit || JSON.stringify(ids) === JSON.stringify(initialIds)} onClick={save}>
            {cancelOnly || !ids.length ? 'Confirmer l’annulation' : 'Enregistrer l’échange'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

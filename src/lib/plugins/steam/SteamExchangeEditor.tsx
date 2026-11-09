import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRightLeft, Gamepad2, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SteamPropertyField } from '@/components/fields/SteamPropertyField';
import { normalizeRelationIds } from '@/lib/utils/relationUtils';
import type { Collection, Item } from '@/lib/types';
import { SteamImage } from './SteamImage';
import { getSteamAppId, getSteamDisplayName } from './steamUtils';
import { canReceiveSteamGame, steamExchanges, steamGameName, steamGameTitle, steamPaidPropertyId } from './exchanges';

function GameArtwork({ appId, large = false }: { appId: number | null; large?: boolean }) {
  const fallback = <Gamepad2 aria-hidden="true" className={large ? 'size-6' : 'size-4'} />;
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 ${large ? 'aspect-[2.14] w-28 sm:w-40' : 'h-8 w-16'}`}>
      {appId ? <SteamImage appid={appId} alt="" loading={large ? 'eager' : 'lazy'} className="h-full w-full object-cover" fallback={fallback} /> : fallback}
    </span>
  );
}

export function SteamExchangeEditor({ collection, item, receivedIds, bundleRelationPropertyId, onChange, onCreate, onOpenItem, standalone = false }: {
  collection: Collection;
  item: Item;
  receivedIds: string[];
  bundleRelationPropertyId?: string;
  standalone?: boolean;
  onChange?: (ids: string[]) => void;
  onCreate?: (game: unknown) => void;
  onOpenItem?: (item: Item) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const open = standalone || expanded;
  const [search, setSearch] = useState('');
  const paidField = steamPaidPropertyId(collection);
  const [creating, setCreating] = useState(false);
  const [newGame, setNewGame] = useState<unknown>('');
  const graph = useMemo(() => steamExchanges(collection), [collection]);
  const parent = graph.parents.get(item.id);
  const root = graph.root(item);
  const steamField = collection.properties.find((property) => property.type === 'steam');
  const appId = (game: Item) => getSteamAppId(steamField && game[steamField.id]) ?? getSteamAppId(game.name);
  const bundleIds = bundleRelationPropertyId ? normalizeRelationIds(root[bundleRelationPropertyId]) : [];
  const selected = receivedIds.map((id) => collection.items.find((candidate) => candidate.id === id)).filter((candidate): candidate is Item => Boolean(candidate));
  const query = search.trim().toLocaleLowerCase();
  const candidates = open ? collection.items.filter((candidate) => {
    if (receivedIds.includes(candidate.id) || !canReceiveSteamGame(item, candidate, graph)) return false;
    const title = steamGameTitle(collection, candidate);
    if (!title || !title.toLocaleLowerCase().includes(query)) return false;
    const candidateBundles = bundleRelationPropertyId ? normalizeRelationIds(candidate[bundleRelationPropertyId]) : [];
    return bundleIds.length
      ? candidateBundles.some((id) => bundleIds.includes(id))
      : candidateBundles.length === 0;
  }).slice(0, 20) : [];

  if (!onChange && !parent && !selected.length && !standalone) return null;

  return (
    <section className={standalone ? 'space-y-5' : 'space-y-3 border-b border-border px-4 py-3'}>
      {standalone && (
        <div className="flex items-center gap-4 rounded-lg bg-[#142436] p-3 text-white sm:gap-5 sm:p-4">
          <GameArtwork appId={appId(item)} large />
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-1.5 text-xs text-sky-200"><ArrowDownRight size={14} aria-hidden="true" /> Jeu donné</p>
            <p className="break-words text-base font-semibold leading-tight sm:text-xl">{steamGameName(collection, item)}</p>
            {parent && <p className="mt-1 text-xs text-slate-300">Reçu en échange de {steamGameName(collection, parent)}</p>}
          </div>
        </div>
      )}
      {!standalone && parent && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Reçu en échange de</span>
          {onOpenItem ? <Button type="button" size="sm" variant="outline" onClick={() => onOpenItem(parent)}>{steamGameName(collection, parent)}</Button> : <span>{steamGameName(collection, parent)}</span>}
          {onOpenItem && root.id !== parent.id && <Button type="button" size="sm" variant="ghost" onClick={() => onOpenItem(root)}>Achat d’origine</Button>}
        </div>
      )}
      {onChange && !standalone && (
        <Button type="button" size="sm" variant="outline" aria-expanded={open} onClick={() => setExpanded(!expanded)}>
          <ArrowRightLeft size={14} /> {selected.length ? 'Modifier l’échange' : 'Enregistrer un échange'}
        </Button>
      )}
      {(open || selected.length > 0) && (
        <div className={open && onChange ? 'grid gap-4 sm:grid-cols-2' : undefined}>
          <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Jeux reçus</h3>
              <span className="min-w-6 rounded bg-background px-1.5 py-0.5 text-center text-xs tabular-nums text-muted-foreground">{selected.length}</span>
            </div>
            {selected.length ? (
              <ul className="max-h-56 divide-y divide-border overflow-y-auto">
                {selected.map((game) => (
                  <li key={game.id} className="flex items-center gap-2 py-2">
                    <GameArtwork appId={appId(game)} />
                    {onOpenItem && !game._steamExchangeDraft
                      ? <button type="button" className="min-w-0 flex-1 break-words text-left text-sm font-medium hover:underline" onClick={() => onOpenItem(game)}>{steamGameName(collection, game)}</button>
                      : <span className="min-w-0 flex-1 break-words text-sm font-medium">{steamGameName(collection, game)}</span>}
                    {open && onChange && (
                      <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" aria-label={`Retirer ${steamGameName(collection, game)}`} onClick={() => onChange(receivedIds.filter((id) => id !== game.id))}><X size={15} /></Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="rounded-md border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">Les jeux ajoutés à l’échange apparaîtront ici.</p>}
            {open && onChange && selected.length > 0 && (
              <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => onChange([])}>Tout retirer</Button>
            )}
          </div>
          {open && onChange && (
            <div className="min-w-0 space-y-2">
              <h3 className="text-sm font-semibold">{bundleIds.length ? 'Jeux du bundle' : 'Jeux disponibles'}</h3>
              <div className="relative">
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="search" aria-label="Rechercher un jeu reçu" placeholder="Rechercher un jeu…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                {candidates.length ? (
                  <ul className="divide-y divide-border">
                    {candidates.map((candidate) => (
                      <li key={candidate.id}>
                        <button type="button" aria-label={`Ajouter ${steamGameName(collection, candidate)}`} className="flex w-full items-center gap-2 px-2 py-2 text-left text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500" onClick={() => onChange([...receivedIds, candidate.id])}>
                          <GameArtwork appId={appId(candidate)} />
                          <span className="min-w-0 flex-1 break-words font-medium">{steamGameName(collection, candidate)}</span>
                          <Plus aria-hidden="true" size={16} className="shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="p-3 text-sm text-muted-foreground">{query ? 'Aucun résultat pour cette recherche.' : 'Aucun autre jeu disponible.'}</p>}
              </div>
              {onCreate && !creating && (
                <Button type="button" size="sm" variant="outline" className="w-full justify-start" onClick={() => setCreating(true)}><Plus size={15} /> Créer un jeu reçu</Button>
              )}
              {onCreate && creating && (
                <div className="space-y-2 rounded-md border border-border p-2">
                  <SteamPropertyField value={newGame} onChange={setNewGame} inlineSuggestions />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setNewGame(''); setCreating(false); }}>Fermer la création</Button>
                    <Button type="button" size="sm" disabled={!getSteamDisplayName(newGame).trim()} onClick={() => {
                      onCreate(newGame);
                      setNewGame('');
                      setCreating(false);
                    }}>Ajouter le jeu</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {open && onChange && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {paidField ? 'Le total payé conserve le prix de l’achat d’origine.' : 'Configure le champ du prix payé dans les paramètres Steam pour calculer le total payé.'}
        </p>
      )}
    </section>
  );
}

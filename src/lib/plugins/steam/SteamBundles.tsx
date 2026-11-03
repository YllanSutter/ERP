import { useItems } from '@/lib/hooks/useItems';
import { getSteamBundleConfig } from './collectionRoles';
import { useEffect, useRef, useState } from 'react';
import { pluginManager } from '@/lib/plugins';
import { useCanEdit } from '@/lib/hooks/useCanEdit';
import { bundleGroupPrefill, bundleTitleProperty, importBundle } from './bundles';
import {
  activeBundleGroupPath,
  bundleGroupScheme,
  publicBundleGroupValues,
} from './bundleGrouping';
import { BundleGroupedList } from './BundleGroupedList';
import { BundlePublishingDialog } from './BundlePublishingDialog';
import { bundleRequest, loadPublicBundles, STEAM_API } from './bundleApi';
import EditableProperty from '@/components/fields/EditableProperty';

export function SteamBundles({
  organizationId,
  collection,
  collections,
  setCollections,
  groupPath,
  groups,
  properties,
  view = {},
}: any) {
  const latestCollections = useRef(collections);
  useEffect(() => {
    latestCollections.current = collections;
  }, [collections]);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [, redraw] = useState(0);
  useEffect(() => {
    const refresh = () => redraw((v) => v + 1);
    window.addEventListener('steam-config-changed', refresh);
    return () => window.removeEventListener('steam-config-changed', refresh);
  }, []);
  const config = getSteamBundleConfig(collections);
  const games = collections.find((c: any) => c.id === config.gamesCollectionId);
  const bundles = collections.find((c: any) => c.id === config.bundlesCollectionId);
  const { saveItem } = useItems(collections, setCollections, bundles?.id || null);
  const canGames = useCanEdit(games?.id);
  const canBundles = useCanEdit(bundles?.id);
  const [openingPath, setOpeningPath] = useState('');
  const [mode, setMode] = useState<'create' | 'import' | 'publish' | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [publicBundles, setPublicBundles] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (
    !organizationId ||
    !pluginManager.isPluginActive(organizationId, 'steam') ||
    !games ||
    !bundles ||
    ![games.id, bundles.id].includes(collection.id)
  )
    return null;
  const scheme = bundleGroupScheme(groups, properties, collection, bundles, view, openingPath);
  const run = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const button = 'rounded border px-3 py-2 text-sm hover:bg-neutral-500/10 disabled:opacity-50';
  const importSnapshot = (snapshot: any) => {
    if (!alive.current) return;
    setCollections(importBundle(snapshot, latestCollections.current, config));
    setMode(null);
  };
  const renderPublicItems = (rows: any[]) => (
    <div>
      {rows.map((row) => {
        const b = row.publication;
        return (
          <div key={b.id} className="flex flex-wrap gap-2 items-center border-b py-3">
            <span className="flex-1">
              {b.title} · {b.gameCount} jeux
            </span>
            <a
              className={button}
              href={`${STEAM_API}/public-bundles/${b.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Voir
            </a>
            {canGames && canBundles && (
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const snapshot = await bundleRequest(`public-bundles/${b.id}?format=json`);
                    importSnapshot(snapshot);
                  })
                }
              >
                Importer avec les jeux
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
  return (
    <div className="px-4 py-2 flex gap-2 items-center flex-wrap">
      {canBundles && collection.id === games.id && (
        <button
          className={button}
          onClick={() => {
            const path = activeBundleGroupPath(collection.id, groups, groupPath);
            setDraft(bundleGroupPrefill(path, groups, properties, games, bundles));
            setMode('create');
            setError('');
          }}
        >
          Créer un bundle
        </button>
      )}
      <button
        className={button}
        onClick={() => {
          setOpeningPath(activeBundleGroupPath(collection.id, groups, groupPath));
          setMode('import');
          setPublicBundles([]);
          void run(async () => {
            const entries = await loadPublicBundles();
            if (alive.current) setPublicBundles(entries);
          });
        }}
      >
        Importer un bundle
      </button>
      {canBundles && (
        <button
          className={button}
          onClick={() => {
            setOpeningPath(activeBundleGroupPath(collection.id, groups, groupPath));
            setMode('publish');
          }}
        >
          Publier un bundle
        </button>
      )}
      {mode === 'publish' && (
        <BundlePublishingDialog
          bundles={bundles}
          collections={collections}
          scheme={scheme}
          onClose={() => setMode(null)}
        />
      )}
      {(mode === 'create' || mode === 'import') && (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={mode === 'create' ? 'Créer un bundle' : 'Importer un bundle'}
            className="bg-white dark:bg-neutral-950 rounded-xl p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto space-y-4"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {mode === 'create' ? 'Créer un bundle' : 'Importer un bundle'}
              </h2>
              <button className={button} onClick={() => setMode(null)}>
                Fermer
              </button>
            </div>
            {error && (
              <p role="alert" className="text-red-500">
                {error}
              </p>
            )}
            {mode === 'create' ? (
              <>
                {bundles.properties
                  .filter(
                    (p: any) =>
                      [
                        'text',
                        'number',
                        'date',
                        'select',
                        'multiselect',
                        'multi_select',
                        'checkbox',
                        'relation',
                      ].includes(p.type) &&
                      !p.isRelationLinkedColumn &&
                      p.relation?.targetCollectionId !== games.id,
                  )
                  .map((p: any) => (
                    <label key={p.id} className="block text-sm">
                      {p.name}
                      <EditableProperty
                        property={p}
                        value={draft[p.id]}
                        onChange={(value: any) => setDraft((prev) => ({ ...prev, [p.id]: value }))}
                        collections={collections}
                        collection={bundles}
                        currentItem={draft}
                        onRelationChange={(property, _item, value) =>
                          setDraft((prev) => ({ ...prev, [property.id]: value }))
                        }
                      />
                    </label>
                  ))}
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => {
                    const title = bundleTitleProperty(bundles);
                    if (!title || !String(draft[title.id] || '').trim()) {
                      setError('Renseignez le nom du bundle (champ texte).');
                      return;
                    }
                    saveItem(draft, null, bundles.id);
                    setMode(null);
                  }}
                >
                  Créer
                </button>
              </>
            ) : (
              <>
                {canGames && canBundles && (
                  <label className="block text-sm">
                    Importer un fichier bundle
                    <input
                      type="file"
                      accept="application/json,.json"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          void run(async () => {
                            if (file.size > 5_000_000) throw new Error('Fichier trop volumineux.');
                            importSnapshot(JSON.parse(await file.text()));
                          });
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
                <p className="text-xs text-neutral-500">
                  Le catalogue s’ouvre sur les groupes sélectionnés dans la vue, par exemple l’année
                  et le mois. L’import réutilise les jeux déjà présents par leur identifiant Steam
                  et copie les champs de même nom et de même type.
                </p>
                {busy && <p className="text-sm text-neutral-500">Chargement…</p>}
                <BundleGroupedList
                  items={publicBundles.map((b) => publicBundleGroupValues(b, bundles))}
                  bundles={bundles}
                  collections={collections}
                  scheme={scheme}
                  storageId={`steam-import:${bundles.id}`}
                  renderItems={renderPublicItems}
                />
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

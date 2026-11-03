import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useCanEdit } from '@/lib/hooks/useCanEdit';
import { pluginManager } from '@/lib/plugins';
import { getSteamBundleConfig } from './collectionRoles';
import { bundleTitle } from './bundles';
import { bundleRequest, STEAM_API } from './bundleApi';
import { BundleGroupedList } from './BundleGroupedList';

export function BundlePublishingDialog({ bundles, collections, scheme, bundleId, onClose }: any) {
  const [own, setOwn] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    bundleRequest('bundles/publications')
      .then((data) => {
        if (active) setOwn(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setOwn(await bundleRequest('bundles/publications'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const button = 'rounded border px-3 py-2 text-sm hover:bg-neutral-500/10 disabled:opacity-50';
  const items = bundleId ? bundles.items.filter((b: any) => b.id === bundleId) : bundles.items;
  const renderItems = (rows: any[]) => (
    <div>
      {rows.map((b) => {
        const published = own.find((p) => p.bundle_id === b.id);
        return (
          <div key={b.id} className="flex flex-wrap items-center gap-2 border-b py-3">
            <span className="flex-1 font-medium">{bundleTitle(bundles, b)}</span>
            <span className="text-xs text-neutral-500">
              {published ? `Public · ${published.gameCount ?? 0} jeux partagés` : 'Privé'}
              {published?.excludedGameCount > 0
                ? ` · ${published.excludedGameCount} jeux sans identifiant exclus`
                : ''}
            </span>
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await bundleRequest(`bundles/${encodeURIComponent(b.id)}/publish`, {
                    method: 'POST',
                  });
                })
              }
            >
              {published ? 'Actualiser la publication' : 'Rendre public'}
            </button>
            {published && (
              <>
                <a
                  className={button}
                  href={`${STEAM_API}/public-bundles/${published.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Lien public
                </a>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await bundleRequest(`bundles/publications/${published.id}`, {
                        method: 'DELETE',
                      });
                    })
                  }
                >
                  Rendre privé
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Publier un bundle"
        className="bg-white dark:bg-neutral-950 rounded-xl p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto space-y-4"
      >
        <div className="flex justify-between items-center gap-4">
          <h2 className="text-lg font-semibold">Publier un bundle</h2>
          <button className={button} onClick={onClose}>
            Fermer
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          La publication est actualisée automatiquement après les sauvegardes du bundle ou de ses
          jeux. Vous pouvez aussi la mettre à jour ici. Seuls les jeux ayant un Steam App ID valide
          sont partagés ; les autres restent dans votre collection. Les champs secrets et les autres
          relations sont exclus.
        </p>
        {error && (
          <p role="alert" className="text-red-500">
            {error}
          </p>
        )}
        {bundleId ? (
          renderItems(items)
        ) : (
          <BundleGroupedList
            items={items}
            bundles={bundles}
            collections={collections}
            scheme={scheme}
            storageId={`steam-publish:${bundles.id}`}
            renderItems={renderItems}
          />
        )}
      </section>
    </div>,
    document.body,
  );
}

/** Small integration point for an existing bundle's item sheet. */
export function SteamBundlePublishButton({ collection, item, collections }: any) {
  const { activeOrganizationId } = useAuth();
  const canEdit = useCanEdit(collection?.id);
  const [open, setOpen] = useState(false);
  const config = getSteamBundleConfig(collections);
  if (
    !item?.id ||
    collection?.id !== config.bundlesCollectionId ||
    !activeOrganizationId ||
    !canEdit ||
    !pluginManager.isPluginActive(activeOrganizationId, 'steam')
  )
    return null;
  return (
    <>
      <button
        type="button"
        className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-500/10"
        onClick={() => setOpen(true)}
      >
        Publication du bundle
      </button>
      {open && (
        <BundlePublishingDialog
          key={activeOrganizationId}
          bundles={collection}
          collections={collections}
          bundleId={item.id}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

import ViewGrouping from '@/components/views/ViewGrouping';
import type { Collection, Item } from '@/lib/types';

export function BundleGroupedList({
  items,
  bundles,
  scheme,
  storageId,
  collections,
  renderItems,
}: {
  items: Item[];
  bundles: Collection;
  scheme: any;
  storageId: string;
  collections: Collection[];
  renderItems: (items: Item[]) => React.ReactNode;
}) {
  if (!items.length) return <p className="text-sm text-neutral-500">Aucun bundle.</p>;
  return (
    <ViewGrouping
      items={items}
      groups={scheme.groups}
      properties={bundles.properties}
      collections={collections}
      groupDisplayMode={scheme.groupDisplayMode}
      groupDisplayModes={scheme.groupDisplayModes}
      initialGroupPath={scheme.initialGroupPath}
      collectionId={storageId}
      renderItems={(rows) =>
        rows.length ? (
          renderItems(rows)
        ) : (
          <p className="py-3 text-sm text-neutral-500">Aucun bundle pour cette sélection.</p>
        )
      }
    />
  );
}

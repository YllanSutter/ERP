import React from 'react';
import * as Icons from 'lucide-react';
import { newestFirst, normalizeSearch } from '@/lib/utils/recentItems';
import { CommandGroup, CommandItem, CommandShortcut } from '@/components/ui/command';

const MAX_ITEMS_IN_COMMAND_MENU = 500;

function getItemDisplayName(item: any, collection: any): string {
  const nameField = collection?.properties?.find(
    (p: any) => p.id === 'name' || p.name === 'Nom'
  );
  if (nameField) {
    const v = item?.[nameField.id];
    if (typeof v === 'string' && v.trim()) return v;
  }
  if (typeof item?.name === 'string' && item.name.trim()) return item.name;
  if (typeof item?.title === 'string' && item.title.trim()) return item.title;
  return 'Sans titre';
}

export default function ItemSearchResults({ collections, query, onSelectItem }: {
  collections: any[];
  query: string;
  onSelectItem: (collection: any, item: any) => void;
}) {
  const allItems = React.useMemo(() => {
    const out: Array<{ collection: any; item: any; name: string }> = [];
    for (const col of collections || []) {
      const items = Array.isArray(col?.items) ? col.items : [];
      for (const item of items) {
        out.push({
          collection: col,
          item,
          name: getItemDisplayName(item, col),
        });

      }
    }
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
    return newestFirst(out, entry => entry.item)
      .filter(entry => terms.every(term => normalizeSearch(`${entry.name} ${entry.collection.name}`).includes(term)))
      .slice(0, query.trim() ? MAX_ITEMS_IN_COMMAND_MENU : 12);
  }, [collections, query]);

  return <>
        {allItems.length > 0 && (
          <CommandGroup heading={query.trim() ? "Éléments · plus récents en premier" : "Éléments récents"}>
            {allItems.map(({ collection, item, name }) => {
              const IconComponent = (Icons as any)[collection?.icon] || Icons.FileText;
              return (
                <CommandItem
                  key={`item-${collection.id}-${item.id}`}
                  value={`item-${collection.id}-${item.id}`} keywords={[collection.name, name]}
                  onSelect={() => onSelectItem(collection, item)}
                >
                  <IconComponent className="text-muted-foreground" />
                  <span className="truncate">{name}</span>
                  <CommandShortcut>{collection.name}</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

  </>;
}

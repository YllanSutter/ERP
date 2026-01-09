import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Star, ChevronDown, ChevronRight } from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collections: any[];
  views: Record<string, any[]>;
  favorites: { views: string[]; items: string[] };
  activeCollection: string | null;
  onSelectCollection: (collectionId: string) => void;
  onEditCollection: (collection: any) => void;
  onToggleFavoriteView: (viewId: string) => void;
  onToggleFavoriteItem: (itemId: string) => void;
  onSelectView: (collectionId: string, viewId: string) => void;
  onSelectItem: (collectionId: string, itemId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  collections,
  views,
  favorites,
  activeCollection,
  onSelectCollection,
  onEditCollection,
  onToggleFavoriteView,
  onToggleFavoriteItem,
  onSelectView,
  onSelectItem,
}) => {
  const [expandedFavorites, setExpandedFavorites] = useState(true);

  // Construire la liste des vues favorites avec leurs infos
  const favoriteViewsList = favorites.views
    .map((viewId) => {
      for (const [collectionId, collectionViews] of Object.entries(views)) {
        const view = collectionViews.find((v: any) => v.id === viewId);
        if (view) {
          const collection = collections.find((c) => c.id === collectionId);
          return { view, collection, collectionId };
        }
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Construire la liste des items favoris avec leurs infos
  const favoriteItemsList = favorites.items
    .map((itemId) => {
      for (const collection of collections) {
        const item = collection.items.find((it: any) => it.id === itemId);
        if (item) {
          const nameField = collection.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');
          const itemName = nameField ? item[nameField.id] || 'Sans titre' : item.name || 'Sans titre';
          return { item, collection, itemName };
        }
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  console.log('Favorites state:', favorites);
  console.log('Favorite views IDs:', favorites.views);
  console.log('Favorite views list:', favoriteViewsList);
  console.log('Favorite items list:', favoriteItemsList);

  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="w-64 border-r border-white/5 bg-neutral-950/50 backdrop-blur overflow-y-auto p-4"
    >
      {/* Section Favoris */}
      {(favoriteViewsList.length > 0 || favoriteItemsList.length > 0) && (
        <div className="mb-6">
          <button
            onClick={() => setExpandedFavorites(!expandedFavorites)}
            className="w-full flex items-center gap-2 text-xs font-semibold text-neutral-500 uppercase mb-3 pl-2 hover:text-neutral-400 transition-colors"
          >
            {expandedFavorites ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Star size={12} className="text-yellow-500" fill="currentColor" />
            Favoris
          </button>

          {expandedFavorites && (
            <div className="space-y-1 mb-4">
              {favoriteViewsList.map(({ view, collection, collectionId }: any) => {
                const IconComponent = (Icons as any)[collection.icon] || Icons.Folder;
                return (
                  <button
                    key={view.id}
                    onClick={() => onSelectView(collectionId, view.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-neutral-300 hover:text-white transition-colors text-sm group"
                  >
                    <IconComponent size={14} style={{ color: collection.color || '#8b5cf6' }} />
                    <span className="flex-1 text-left truncate">{view.name}</span>
                    <Star
                      size={12}
                      className="text-yellow-500 opacity-60 group-hover:opacity-100"
                      fill="currentColor"
                    />
                  </button>
                );
              })}

              {favoriteItemsList.map(({ item, collection, itemName }: any) => {
                const IconComponent = (Icons as any)[collection.icon] || Icons.Folder;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectItem(collection.id, item.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-neutral-300 hover:text-white transition-colors text-sm group"
                  >
                    <IconComponent size={14} style={{ color: collection.color || '#8b5cf6' }} />
                    <span className="flex-1 text-left truncate">{itemName}</span>
                    <Star
                      size={12}
                      className="text-yellow-500 opacity-60 group-hover:opacity-100"
                      fill="currentColor"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section Collections */}
      <h2 className="text-xs font-semibold text-neutral-500 uppercase mb-4 pl-2">Collections</h2>
      {collections.map((col, i) => {
        const IconComponent = (Icons as any)[col.icon] || Icons.Folder;
        return (
          <motion.div
            key={col.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i }}
            className="group relative mb-2"
          >
            <button
              onClick={() => onSelectCollection(col.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 pr-10 py-2.5 rounded-lg transition-all',
                activeCollection === col.id
                  ? 'bg-gradient-to-r from-violet-500/30 to-cyan-500/30 border border-violet-500/50 text-white'
                  : 'hover:bg-white/5 text-neutral-400 hover:text-white'
              )}
              style={
                activeCollection === col.id
                  ? {
                      borderColor: `${col.color}80`,
                      background: `linear-gradient(to right, ${col.color}30, ${col.color}10)`
                    }
                  : {}
              }
            >
              <IconComponent size={20} style={{ color: col.color || '#8b5cf6' }} />
              <span className="font-medium flex-1 text-left">{col.name}</span>
              <span className="text-xs text-neutral-500 bg-white/5 px-2 py-1 rounded">
                {col.items.length}
              </span>
            </button>
            <button
              onClick={() => onEditCollection(col)}
              className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
              title="Éditer la collection"
            >
              <Settings size={16} />
            </button>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default Sidebar;

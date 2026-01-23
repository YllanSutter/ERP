import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Star,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Plus,
  Copy,
  Trash,
  ArrowUpDown
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collections: any[];
  views: Record<string, any[]>;
  favorites: { views: string[]; items: string[] };
  activeCollection: string | null;
  dashboards: any[];
  userRoleIds: string[];
  userId: string | null;
  onSelectCollection: (collectionId: string) => void;
  onEditCollection: (collection: any) => void;
  onToggleFavoriteView: (viewId: string) => void;
  onToggleFavoriteItem: (itemId: string) => void;
  onSelectView: (collectionId: string, viewId: string) => void;
  onSelectItem: (collectionId: string, itemId: string) => void;
  onSelectDashboard: (dashboardId: string) => void;
  onCreateDashboard: () => void;
  onDeleteDashboard: (dashboardId: string) => void;
  onDuplicateDashboard: (dashboardId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  collections,
  views,
  favorites,
  activeCollection,
  dashboards,
  userRoleIds,
  userId,
  onSelectCollection,
  onEditCollection,
  onSelectView,
  onSelectItem,
  onSelectDashboard,
  onCreateDashboard,
  onDeleteDashboard,
  onDuplicateDashboard,
}) => {
  const [expandedFavorites, setExpandedFavorites] = useState(true);

  const canSeeView = (view: any) => {
    const allowedRoles = view?.visibleToRoles || [];
    const allowedUsers = view?.visibleToUsers || [];
    const hasRoleRestriction = allowedRoles.length > 0;
    const hasUserRestriction = allowedUsers.length > 0;
    if (!hasRoleRestriction && !hasUserRestriction) return true;
    const roleOk = hasRoleRestriction ? allowedRoles.some((rid: string) => userRoleIds.includes(rid)) : false;
    const userOk = hasUserRestriction ? allowedUsers.includes(userId) : false;
    return roleOk || userOk;
  };

  // Construire la liste des vues favorites avec leurs infos
  const favoriteViewsList = favorites.views
    .map((viewId) => {
      for (const [collectionId, collectionViews] of Object.entries(views)) {
        const view = collectionViews.find((v: any) => v.id === viewId && canSeeView(v));
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

  // console.log('Favorites state:', favorites);
  // console.log('Favorite views IDs:', favorites.views);
  // console.log('Favorite views list:', favoriteViewsList);
  // console.log('Favorite items list:', favoriteItemsList);

  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="w-64 border-r border-white/5 bg-gray-100 dark:bg-neutral-950/50 backdrop-blur overflow-y-auto p-4"
    >
      {/* Section Favoris */}
      {(favoriteViewsList.length > 0 || favoriteItemsList.length > 0) && (
        <div className="mb-6">
          <button
            onClick={() => setExpandedFavorites(!expandedFavorites)}
            className="w-full flex items-center gap-2 text-xs font-semibold text-neutral-500 mb-3 pl-2 hover:text-neutral-400 transition-colors border-b border-black/5 dark:border-white/5pb-3"
          >
            {expandedFavorites ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Favoris
          </button>

          {expandedFavorites && (
            <div className="space-y-1 mb-4">
              {favoriteViewsList.map(({ view, collection, collectionId }: any) => {
                const IconComponent = (Icons as any)[view.icon] || Icons.Folder;
                return (
                  <button
                    key={view.id}
                    onClick={() => onSelectView(collectionId, view.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-neutral-500 font-medium hover:text-black dark:hover:text-white transition-colors text-sm group"
                  >
                    <IconComponent size={14} class="dark:text-white" />
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
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-neutral-300 hover:text-black dark:hover:text-white transition-colors text-sm group"
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

      {/* Section Dashboards */}
      <div className="mb-6">
        <div className="flex justify-between mb-3 pr-1 border-b border-black/5 dark:border-white/5pb-2">
          <h2 className="text-xs font-semibold text-neutral-500 pl-2 flex items-center gap-2 ">
            Dashboards
          </h2>
          <button
            onClick={onCreateDashboard}
            className="text-neutral-400 hover:text-black dark:hover:text-white p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors h-auto inline-block"
            title="Nouveau dashboard"
          >
            <Plus size={14} />
          </button>
        </div>
        {dashboards.length === 0 ? (
          <div className="text-xs text-neutral-500 px-3 py-2">Aucun dashboard pour l’instant</div>
        ) : (
          <div className="space-y-1">
            {dashboards.map((db, i) => (
              <motion.div
                key={db.id}
                role="button"
                tabIndex={0}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
                onClick={() => onSelectDashboard(db.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectDashboard(db.id);
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors'
                )}
              >
                <LayoutDashboard size={14} className="text-neutral-600 dark:text-white" />
                <span className="flex-1 text-left truncate text-neutral-600 hover:text-black dark:hover:text-white transition-all duration-300">{db.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateDashboard(db.id);
                  }}
                  className="p-1 rounded text-neutral-600 dark:text-white hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10"
                  title="Dupliquer"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDashboard(db.id);
                  }}
                  className="p-1 rounded text-red-800 dark:text-red-300 hover:text-white hover:bg-red-500/30"
                  title="Supprimer"
                >
                  <Trash size={14} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Section Collections */}
      <h2 className="text-xs font-semibold text-neutral-500 mb-4 pl-2 border-b border-black/5 dark:border-white/5pb-2">Collections</h2>
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
                  ? 'bg-white/5  text-black dark:text-white'
                  : 'hover:bg-white/5 text-neutral-600 hover:text-black dark:hover:text-white'
              )}
            >
              <IconComponent size={14} className ="text-neutral-500 dark:text-white" />
              <span className="text-sm font-medium flex-1 text-left">{col.name}</span>
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

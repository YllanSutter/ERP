import React, { useState } from 'react';
import {
  Settings,
  Star,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Plus,
  Copy,
  Trash
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar';

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
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

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

  const SectionHeader = ({ label, action }: { label: string; action?: React.ReactNode }) => (
    <div
      className={cn(
        'flex items-center justify-between border-b border-black/5 dark:border-white/5',
        collapsed ? 'px-1 pb-2' : 'pr-1 pb-2'
      )}
    >
      {!collapsed && <SidebarGroupLabel className="pl-2">{label}</SidebarGroupLabel>}
      {action}
    </div>
  );

  const MenuButton = ({
    icon: Icon,
    label,
    active,
    onClick,
    right,
    title
  }: {
    icon: any;
    label: string;
    active?: boolean;
    onClick: () => void;
    right?: React.ReactNode;
    title?: string;
  }) => (
    <SidebarMenuButton
      onClick={onClick}
      title={title || label}
      isActive={!!active}
      size="default"
      tooltip={label}
      className={cn(collapsed ? 'justify-center' : '')}
    >
      <Icon size={14} className="shrink-0" />
      {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
      {!collapsed && right}
    </SidebarMenuButton>
  );

  return (
    <SidebarRoot
      collapsible="icon"
      className="dark:bg-neutral-950/50 backdrop-blur"
    >
      <SidebarHeader className={cn('mb-4 justify-between', collapsed ? 'justify-center' : 'px-2')}>
        {!collapsed && <div className="text-xs font-semibold text-neutral-500">Navigation</div>}
        <SidebarTrigger
          className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-black dark:hover:text-white"
          title={collapsed ? 'Déplier' : 'Replier'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </SidebarTrigger>
      </SidebarHeader>

      <SidebarContent>
        {(favoriteViewsList.length > 0 || favoriteItemsList.length > 0) && (
          <SidebarGroup className="mb-6">
            <SectionHeader
              label="Favoris"
              action={
                <button
                  onClick={() => setExpandedFavorites(!expandedFavorites)}
                  className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-black dark:hover:text-white"
                  title={expandedFavorites ? 'Réduire' : 'Déplier'}
                >
                  {expandedFavorites ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              }
            />

            {expandedFavorites && (
              <SidebarGroupContent className="mt-2">
                <SidebarMenu>
                  {favoriteViewsList.map(({ view, collectionId }: any) => {
                    const IconComponent = (Icons as any)[view.icon] || Icons.Folder;
                    return (
                      <SidebarMenuItem key={view.id}>
                        <MenuButton
                          icon={IconComponent}
                          label={view.name}
                          onClick={() => onSelectView(collectionId, view.id)}
                          right={<Star size={12} className="text-yellow-500 opacity-60" fill="currentColor" />}
                        />
                      </SidebarMenuItem>
                    );
                  })}

                  {favoriteItemsList.map(({ item, collection, itemName }: any) => {
                    const IconComponent = (Icons as any)[collection.icon] || Icons.Folder;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <MenuButton
                          icon={IconComponent}
                          label={itemName}
                          onClick={() => onSelectItem(collection.id, item.id)}
                          right={<Star size={12} className="text-yellow-500 opacity-60" fill="currentColor" />}
                        />
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        )}

        <SidebarGroup className="mb-6">
          <SectionHeader
            label="Dashboards"
            action={
              <button
                onClick={onCreateDashboard}
                className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-black dark:hover:text-white"
                title="Nouveau dashboard"
              >
                <Plus size={14} />
              </button>
            }
          />
          {dashboards.length === 0 ? (
            <div className="text-xs text-neutral-500 px-3 py-2">Aucun dashboard pour l’instant</div>
          ) : (
            <SidebarGroupContent className="mt-2">
              <SidebarMenu>
                {dashboards.map((db) => (
                  <SidebarMenuItem key={db.id} className="group">
                    <SidebarMenuButton
                      onClick={() => onSelectDashboard(db.id)}
                      title={db.name}
                      size="default"
                      tooltip={db.name}
                      className={cn(collapsed ? 'justify-center' : '')}
                    >
                      <LayoutDashboard size={14} className="text-neutral-600 dark:text-white" />
                      {!collapsed && (
                        <span className="flex-1 text-left truncate text-neutral-600 hover:text-black dark:hover:text-white transition-all duration-300">
                          {db.name}
                        </span>
                      )}
                    </SidebarMenuButton>
                    {!collapsed && (
                      <>
                        <SidebarMenuAction
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateDashboard(db.id);
                          }}
                          title="Dupliquer"
                          showOnHover
                          className="right-10 text-neutral-600 dark:text-white hover:text-black dark:hover:text-white"
                        >
                          <Copy size={14} />
                        </SidebarMenuAction>
                        <SidebarMenuAction
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDashboard(db.id);
                          }}
                          title="Supprimer"
                          showOnHover
                          className="right-2 text-red-800 dark:text-red-300 hover:text-white hover:bg-red-500/30"
                        >
                          <Trash size={14} />
                        </SidebarMenuAction>
                      </>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        <SidebarGroup>
          <SectionHeader label="Collections" />
          <SidebarGroupContent className="mt-2">
            <SidebarMenu>
              {collections.map((col) => {
                const IconComponent = (Icons as any)[col.icon] || Icons.Folder;
                return (
                  <SidebarMenuItem key={col.id} className="group">
                    <SidebarMenuButton
                      onClick={() => onSelectCollection(col.id)}
                      title={col.name}
                      isActive={activeCollection === col.id}
                      size="default"
                      tooltip={col.name}
                      className={cn(collapsed ? 'justify-center' : '')}
                    >
                      <IconComponent size={14} className="text-neutral-500 dark:text-white" />
                      {!collapsed && (
                        <>
                          <span className="text-sm font-medium flex-1 text-left truncate">{col.name}</span>
                          <span className="text-xs text-neutral-500 bg-white/5 px-2 py-1 rounded">
                            {col.items.length}
                          </span>
                        </>
                      )}
                    </SidebarMenuButton>
                    {!collapsed && (
                      <SidebarMenuAction
                        onClick={() => onEditCollection(col)}
                        title="Éditer la collection"
                        showOnHover
                      >
                        <Settings size={16} />
                      </SidebarMenuAction>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </SidebarRoot>
  );
};

export default Sidebar;

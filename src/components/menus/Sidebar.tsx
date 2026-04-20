import React, { useMemo, useState } from 'react';
import {
  Settings,
  Star,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Plus,
  Copy,
  Trash,
  Zap,
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
import { useAuth } from '@/auth/AuthProvider';
import WorkspaceSwitcher from '@/components/menus/WorkspaceSwitcher';

interface SidebarProps {
  collections: any[];
  views: Record<string, any[]>;
  favorites: { views: string[]; items: string[] };
  activeCollection: string | null;
  dashboards: any[];
  userRoleIds: string[];
  userId: string | null;
  organizations?: any[];
  activeOrganizationId?: string | null;
  onSwitchOrganization?: (organizationId: string) => Promise<void>;
  onCreateOrganization?: (name: string) => Promise<void>;
  onSelectCollection: (collectionId: string) => void;
  onEditCollection: (collection: any) => void;
  onToggleFavoriteView: (viewId: string) => void;
  onToggleFavoriteItem: (itemId: string) => void;
  onSelectView: (collectionId: string, viewId: string) => void;
  onSelectItem: (collectionId: string, itemId: string) => void;
  onSelectDashboard: (dashboardId: string) => void;
  onCreateDashboard: () => void;
  onCreateCollection: () => void;
  onDeleteDashboard: (dashboardId: string) => void;
  onDuplicateDashboard: (dashboardId: string) => void;
  onShowAutomations: () => void;
  showAutomations?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  collections,
  views,
  favorites,
  activeCollection,
  dashboards,
  userRoleIds,
  userId,
  organizations,
  activeOrganizationId,
  onSwitchOrganization,
  onCreateOrganization,
  onSelectCollection,
  onEditCollection,
  onSelectView,
  onSelectItem,
  onSelectDashboard,
  onCreateDashboard,
  onCreateCollection,
  onDeleteDashboard,
  onDuplicateDashboard,
  onShowAutomations,
  showAutomations,
}) => {
  const [expandedFavorites, setExpandedFavorites] = useState(true);
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { isAdmin, isEditor, permissions } = useAuth();

  const canReadCollection = useMemo(() => {
    return (collectionId: string) => {
      if (isAdmin || isEditor) return true;
      const perms = permissions || [];
      const collectionPerm = perms.find(
        (p: any) =>
          (p.collection_id || null) === collectionId &&
          (p.item_id || null) === null &&
          (p.field_id || null) === null
      );
      if (collectionPerm) return Boolean(collectionPerm.can_read);
      const globalPerm = perms.find(
        (p: any) =>
          (p.collection_id || null) === null &&
          (p.item_id || null) === null &&
          (p.field_id || null) === null
      );
      if (globalPerm) return Boolean(globalPerm.can_read);
      return false;
    };
  }, [isAdmin, isEditor, permissions]);

  const visibleCollections = useMemo(
    () => (collections || []).filter((c: any) => canReadCollection(c.id)),
    [collections, canReadCollection]
  );

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

  const canSeeDashboard = (dashboard: any) => {
    if (isAdmin) return true; // Admins voient tout
    const allowedRoles = dashboard?.visibleToRoles || [];
    const allowedUsers = dashboard?.visibleToUsers || [];
    const hasRoleRestriction = allowedRoles.length > 0;
    const hasUserRestriction = allowedUsers.length > 0;
    if (!hasRoleRestriction && !hasUserRestriction) return true;
    const roleOk = hasRoleRestriction ? allowedRoles.some((rid: string) => userRoleIds.includes(rid)) : false;
    const userOk = hasUserRestriction ? allowedUsers.includes(userId) : false;
    return roleOk || userOk;
  };

  const visibleDashboards = useMemo(
    () => (dashboards || []).filter(canSeeDashboard),
    [dashboards, userRoleIds, userId, isAdmin]
  );

  // Construire la liste des vues favorites avec leurs infos
  const favoriteViewsList = favorites.views
    .map((viewId) => {
      for (const [collectionId, collectionViews] of Object.entries(views)) {
        if (!canReadCollection(collectionId)) continue;
        const view = collectionViews.find((v: any) => v.id === viewId && canSeeView(v));
        if (view) {
          const collection = visibleCollections.find((c) => c.id === collectionId);
          return { view, collection, collectionId };
        }
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Construire la liste des items favoris avec leurs infos
  const favoriteItemsList = favorites.items
    .map((itemId) => {
      for (const collection of visibleCollections) {
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

  const getViewIcon = (view: any) => {
    if (typeof view?.icon === 'string' && (Icons as any)[view.icon]) {
      return (Icons as any)[view.icon];
    }

    switch (view?.type) {
      case 'table':
        return Icons.Table;
      case 'kanban':
        return Icons.Layout;
      case 'calendar':
        return Icons.Calendar;
      case 'layout':
        return Icons.Layers;
      default:
        return Icons.Folder;
    }
  };

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

  const sharedButtonClass = cn(collapsed ? 'justify-center' : '');
  const sharedHeaderActionClass =
    'p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-black dark:hover:text-white';

  const RowActions = ({ actions }: { actions?: Array<{ title: string; onClick: (e: React.MouseEvent) => void; className?: string; icon: React.ReactNode }> }) => {
    if (collapsed || !actions?.length) return null;
    return (
      <>
        {actions.map((action, idx) => (
          <SidebarMenuAction
            key={`${action.title}-${idx}`}
            onClick={action.onClick}
            title={action.title}
            showOnHover
            className={action.className}
          >
            {action.icon}
          </SidebarMenuAction>
        ))}
      </>
    );
  };

  const SidebarRow = ({
    itemKey,
    icon: Icon,
    label,
    onClick,
    title,
    active,
    right,
    iconClassName = 'text-neutral-500 dark:text-white',
    labelClassName = 'text-[13px] font-medium flex-1 text-left truncate',
    itemClassName,
    actions,
  }: {
    itemKey: string;
    icon: any;
    label: string;
    onClick: () => void;
    title?: string;
    active?: boolean;
    right?: React.ReactNode;
    iconClassName?: string;
    labelClassName?: string;
    itemClassName?: string;
    actions?: Array<{ title: string; onClick: (e: React.MouseEvent) => void; className?: string; icon: React.ReactNode }>;
  }) => (
    <SidebarMenuItem key={itemKey} className={itemClassName}>
      <SidebarMenuButton
        onClick={onClick}
        title={title || label}
        isActive={!!active}
        size="default"
        tooltip={label}
        className={sharedButtonClass}
      >
        <Icon size={14} className={iconClassName} />
        {!collapsed && <span className={labelClassName}>{label}</span>}
        {!collapsed && right}
      </SidebarMenuButton>
      <RowActions actions={actions} />
    </SidebarMenuItem>
  );

  return (
    <SidebarRoot
      collapsible="icon"
      className="dark:bg-neutral-950/50 backdrop-blur"
    >
      <SidebarHeader className={cn('mb-3 gap-2', collapsed ? 'px-1 items-center' : 'px-2')}>
        {organizations && organizations.length > 0 && onSwitchOrganization && onCreateOrganization && (
          <WorkspaceSwitcher
            organizations={organizations}
            activeOrganizationId={activeOrganizationId ?? null}
            onSwitchOrganization={onSwitchOrganization}
            onCreateOrganization={onCreateOrganization}
            collapsed={collapsed}
          />
        )}
        <div className={cn('flex items-center justify-between', collapsed ? 'justify-center' : '')}>
          {!collapsed && <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Navigation</div>}
          <SidebarTrigger
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title={collapsed ? 'D\u00e9plier' : 'Replier'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </SidebarTrigger>
        </div>
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
                    const IconComponent = getViewIcon(view);
                    return (
                      <SidebarRow
                        key={view.id}
                        itemKey={view.id}
                        icon={IconComponent}
                        label={view.name}
                        onClick={() => onSelectView(collectionId, view.id)}
                        right={<Star size={12} className="text-yellow-500 opacity-60" fill="currentColor" />}
                      />
                    );
                  })}

                  {favoriteItemsList.map(({ item, collection, itemName }: any) => {
                    const IconComponent = (Icons as any)[collection.icon] || Icons.Folder;
                    return (
                      <SidebarRow
                        key={item.id}
                        itemKey={item.id}
                        icon={IconComponent}
                        label={itemName}
                        onClick={() => onSelectItem(collection.id, item.id)}
                        right={<Star size={12} className="text-yellow-500 opacity-60" fill="currentColor" />}
                      />
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        )}

        {[
          {
            key: 'dashboards',
            label: 'Dashboards',
            className: 'mb-6',
            headerAction: (
              <button
                onClick={onCreateDashboard}
                className={sharedHeaderActionClass}
                title="Nouveau dashboard"
              >
                <Plus size={14} />
              </button>
            ),
            rows: visibleDashboards.map((db: any) => ({
              key: db.id,
              icon: LayoutDashboard,
              label: db.name,
              onClick: () => onSelectDashboard(db.id),
              itemClassName: 'group',
              actions: [
                {
                  title: 'Dupliquer',
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    onDuplicateDashboard(db.id);
                  },
                  className: 'right-10 text-neutral-600 dark:text-white hover:text-black dark:hover:text-white',
                  icon: <Copy size={14} />,
                },
                {
                  title: 'Supprimer',
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    onDeleteDashboard(db.id);
                  },
                  className: 'right-2 text-red-800 dark:text-red-300 hover:text-white hover:bg-red-500/30',
                  icon: <Trash size={14} />,
                },
              ],
            })),
            empty: <div className="text-xs text-neutral-500 px-3 py-2 max-h-4 inline-block overflow-hidden"></div>,
          },
          {
            key: 'collections',
            label: 'Collections',
            className: '',
            headerAction: (
              <button
                onClick={onCreateCollection}
                className={sharedHeaderActionClass}
                title="Nouvelle collection"
              >
                <Plus size={14} />
              </button>
            ),
            rows: visibleCollections.map((col: any) => {
              const IconComponent = (Icons as any)[col.icon] || Icons.Folder;
              return {
                key: col.id,
                icon: IconComponent,
                label: col.name,
                onClick: () => onSelectCollection(col.id),
                active: activeCollection === col.id,
                itemClassName: 'group',
                right: (
                  <span className="text-xs text-neutral-500 bg-white/5 px-2 py-1 rounded">
                    {col.items.length}
                  </span>
                ),
                actions: [
                  {
                    title: 'Éditer la collection',
                    onClick: () => onEditCollection(col),
                    icon: <Settings size={16} />,
                  },
                ],
              };
            }),
            empty: null,
          },
        ].map((section) => (
          <SidebarGroup key={section.key} className={section.className}>
            <SectionHeader label={section.label} action={section.headerAction || undefined} />
            {section.rows.length === 0 ? (
              section.empty
            ) : (
              <SidebarGroupContent className="mt-2">
                <SidebarMenu>
                  {section.rows.map((row: any) => (
                    <SidebarRow
                      key={row.key}
                      itemKey={row.key}
                      icon={row.icon}
                      label={row.label}
                      onClick={row.onClick}
                      active={row.active}
                      right={row.right}
                      iconClassName={row.iconClassName}
                      labelClassName={row.labelClassName}
                      itemClassName={row.itemClassName}
                      actions={row.actions}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        ))}
        {/* ── Automations ── */}
        <SidebarGroup className="mt-auto pt-2 border-t border-black/5 dark:border-white/5">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onShowAutomations}
                  isActive={showAutomations}
                  tooltip="Automations"
                  size="default"
                  className={cn(
                    sharedButtonClass,
                    showAutomations && 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                  )}
                >
                  <Zap size={16} className={showAutomations ? 'text-yellow-500' : 'text-neutral-500 dark:text-white'} />
                  {!collapsed && (
                    <span className="text-[13px] font-medium">Automations</span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </SidebarRoot>
  );
};

export default Sidebar;

import React from 'react';
import * as Icons from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: any[];
  views: Record<string, any[]>;
  dashboards: any[];
  organizations: any[];
  activeOrganizationId: string | null;
  theme: 'light' | 'dark';
  onSelectCollection: (collectionId: string) => void;
  onSelectView: (collectionId: string, viewId: string) => void;
  onSelectDashboard: (dashboardId: string) => void;
  onSelectItem: (collectionId: string, itemId: string) => void;
  onCreateCollection: () => void;
  onCreateDashboard: () => void;
  onSwitchOrganization: (organizationId: string) => Promise<void>;
  onToggleTheme: () => void;
  onLogout: () => void;
  onShowAutomations: () => void;
}

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

const getViewIcon = (view: any) => {
  if (typeof view?.icon === 'string' && (Icons as any)[view.icon]) {
    return (Icons as any)[view.icon];
  }
  switch (view?.type) {
    case 'table': return Icons.Table;
    case 'kanban': return Icons.Layout;
    case 'calendar': return Icons.Calendar;
    case 'layout': return Icons.Layers;
    default: return Icons.Folder;
  }
};

const CommandMenu: React.FC<CommandMenuProps> = ({
  open,
  onOpenChange,
  collections,
  views,
  dashboards,
  organizations,
  activeOrganizationId,
  theme,
  onSelectCollection,
  onSelectView,
  onSelectDashboard,
  onSelectItem,
  onCreateCollection,
  onCreateDashboard,
  onSwitchOrganization,
  onToggleTheme,
  onLogout,
  onShowAutomations,
}) => {
  useHotkeys(
    'mod+k',
    (e) => {
      e.preventDefault();
      onOpenChange(!open);
    },
    { enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true },
    [open, onOpenChange]
  );

  const runCommand = (fn: () => void) => {
    onOpenChange(false);
    setTimeout(fn, 0);
  };

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
        if (out.length >= MAX_ITEMS_IN_COMMAND_MENU) return out;
      }
    }
    return out;
  }, [collections]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Rechercher éléments, collections, vues, dashboards…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>

        {dashboards.length > 0 && (
          <CommandGroup heading="Dashboards">
            {dashboards.map((db: any) => (
              <CommandItem
                key={`dashboard-${db.id}`}
                value={`dashboard ${db.name}`}
                onSelect={() => runCommand(() => onSelectDashboard(db.id))}
              >
                <Icons.LayoutDashboard className="text-muted-foreground" />
                <span>{db.name}</span>
                <CommandShortcut>Dashboard</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {collections.length > 0 && (
          <CommandGroup heading="Collections">
            {collections.map((col: any) => {
              const IconComponent = (Icons as any)[col.icon] || Icons.Folder;
              return (
                <CommandItem
                  key={`collection-${col.id}`}
                  value={`collection ${col.name}`}
                  onSelect={() => runCommand(() => onSelectCollection(col.id))}
                >
                  <IconComponent className="text-muted-foreground" />
                  <span>{col.name}</span>
                  <CommandShortcut>{col.items?.length ?? 0} items</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {collections.some((c) => (views[c.id] || []).length > 0) && (
          <CommandGroup heading="Vues">
            {collections.flatMap((col: any) =>
              (views[col.id] || []).map((view: any) => {
                const IconComponent = getViewIcon(view);
                return (
                  <CommandItem
                    key={`view-${col.id}-${view.id}`}
                    value={`view ${col.name} ${view.name}`}
                    onSelect={() => runCommand(() => onSelectView(col.id, view.id))}
                  >
                    <IconComponent className="text-muted-foreground" />
                    <span>{view.name}</span>
                    <CommandShortcut>{col.name}</CommandShortcut>
                  </CommandItem>
                );
              })
            )}
          </CommandGroup>
        )}

        {allItems.length > 0 && (
          <CommandGroup heading="Éléments">
            {allItems.map(({ collection, item, name }) => {
              const IconComponent = (Icons as any)[collection?.icon] || Icons.FileText;
              return (
                <CommandItem
                  key={`item-${collection.id}-${item.id}`}
                  value={`item ${collection.name} ${name}`}
                  onSelect={() => runCommand(() => onSelectItem(collection.id, item.id))}
                >
                  <IconComponent className="text-muted-foreground" />
                  <span className="truncate">{name}</span>
                  <CommandShortcut>{collection.name}</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {organizations.length > 1 && (
          <CommandGroup heading="Organisations">
            {organizations
              .filter((o) => o.id !== activeOrganizationId)
              .map((org: any) => (
                <CommandItem
                  key={`org-${org.id}`}
                  value={`organisation ${org.name}`}
                  onSelect={() => runCommand(() => { onSwitchOrganization(org.id); })}
                >
                  <Icons.Building2 className="text-muted-foreground" />
                  <span>Basculer vers {org.name}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            value="action nouvelle collection"
            onSelect={() => runCommand(onCreateCollection)}
          >
            <Icons.Plus className="text-muted-foreground" />
            <span>Nouvelle collection</span>
          </CommandItem>
          <CommandItem
            value="action nouveau dashboard"
            onSelect={() => runCommand(onCreateDashboard)}
          >
            <Icons.LayoutDashboard className="text-muted-foreground" />
            <span>Nouveau dashboard</span>
          </CommandItem>
          <CommandItem
            value="action automations"
            onSelect={() => runCommand(onShowAutomations)}
          >
            <Icons.Zap className="text-muted-foreground" />
            <span>Ouvrir les automations</span>
          </CommandItem>
          <CommandItem
            value="action theme"
            onSelect={() => runCommand(onToggleTheme)}
          >
            {theme === 'dark' ? (
              <Icons.Sun className="text-muted-foreground" />
            ) : (
              <Icons.Moon className="text-muted-foreground" />
            )}
            <span>Basculer en mode {theme === 'dark' ? 'clair' : 'sombre'}</span>
          </CommandItem>
          <CommandItem
            value="action logout deconnexion"
            onSelect={() => runCommand(onLogout)}
          >
            <Icons.LogOut className="text-muted-foreground" />
            <span>Déconnexion</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default CommandMenu;

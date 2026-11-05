import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsTabs, SettingsTabContent } from '@/components/ui/settings-panel';
import type { AccessContext } from './panelTypes';

type Scope = Parameters<AccessContext['findPermission']>[1];

function PermissionFlags({ context, roleId, scope }: { context: AccessContext; roleId: string; scope: Scope }) {
  const permission = context.findPermission(roleId, scope);
  const flags = scope.type === 'property'
    ? context.flags.filter(({ key }) => ['can_read', 'can_write', 'can_delete'].includes(key))
    : context.flags;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
      {flags.map(({ key, label, hint }) => (
        <label key={key} title={hint} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            className="size-4 accent-brand-600"
            checked={Boolean(permission[key])}
            onChange={(event) => context.toggleFlag(roleId, scope, key, event.target.checked)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export const PermissionsPanel = ({ context }: { context: AccessContext }) => {
  const roleId = context.selectedRoleId;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-40 flex-1 sm:max-w-sm">
          <span className="sr-only">Rôle à configurer</span>
          <Select
            value={roleId || ''}
            onValueChange={(value) => context.setSelectedRoleId(value || null)}
          >
            <SelectTrigger aria-label="Rôle à configurer" className="h-8 min-w-0 text-xs"><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
            <SelectContent className="p-1">
              {context.roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <Button type="button" size="sm" variant="outline" onClick={() => context.setCreatingRole(!context.creatingRole)}>
          <Plus /> Nouveau rôle
        </Button>
      </div>
      {context.creatingRole && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
          onSubmit={(event) => { event.preventDefault(); void context.createRole(); }}
        >
          <label className="grid min-w-32 flex-1 gap-1.5 text-sm font-medium">
            Nom du rôle
            <Input value={context.newRoleName} onChange={(event) => context.setNewRoleName(event.target.value)} />
          </label>
          <label className="grid min-w-40 flex-1 gap-1.5 text-sm font-medium">
            Description
            <Input placeholder="Facultative" value={context.newRoleDesc} onChange={(event) => context.setNewRoleDesc(event.target.value)} />
          </label>
          <Button type="submit" disabled={context.busy || !context.newRoleName.trim()}>Créer le rôle</Button>
        </form>
      )}
      {roleId ? (
        <SettingsTabs value={context.permissionsTab} onValueChange={(value) => context.setPermissionsTab(value as AccessContext['permissionsTab'])} inline label="Portée des permissions" items={[{id:'global',label:'Globales'},{id:'collections',label:'Collections'},{id:'dashboards',label:'Tableaux de bord'}]}>
          <SettingsTabContent value="global">
            <p className="mb-1.5 text-xs text-muted-foreground">S’applique à toutes les collections et à leurs champs.</p>
            <PermissionFlags context={context} roleId={roleId} scope={{ type: 'global', collectionId: null, fieldId: null }} />
          </SettingsTabContent>
          <SettingsTabContent value="collections">
            {context.collectionsWithProps.length === 0 && <p className="text-sm text-muted-foreground">Aucune collection.</p>}
            {context.collectionsWithProps.map((collection) => (
              <details key={collection.id} className="group rounded-xl border border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-1.5 text-sm font-semibold">
                  {collection.name}
                  <ChevronDown size={16} className="shrink-0 text-muted-foreground group-open:rotate-180" />
                </summary>
                <div className="border-t border-border p-2">
                  <h3 className="mb-1.5 text-sm font-medium">Accès à la collection</h3>
                  <PermissionFlags context={context} roleId={roleId} scope={{ type: 'collection', collectionId: collection.id, fieldId: null }} />
                </div>
                {collection.properties.length > 0 && (
                  <div className="border-t border-border px-2">
                    <h3 className="pt-2 text-sm font-medium">Accès par champ</h3>
                    <ul className="divide-y divide-border">
                      {collection.properties.map((property: { id: string; name: string; type: string }) => (
                        <li key={property.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-1.5">
                          <span className="text-sm">{property.name} <span className="text-xs text-muted-foreground">{property.type}</span></span>
                          <PermissionFlags context={context} roleId={roleId} scope={{ type: 'property', collectionId: collection.id, fieldId: property.id }} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </details>
            ))}
          </SettingsTabContent>
          <SettingsTabContent value="dashboards">
            {context.dashboards.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aucun tableau de bord.</p>
            ) : (
              <ul className="divide-y divide-border">
                {context.dashboards.map((dashboard) => (
                  <li key={dashboard.id}>
                    <label className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-2 py-1.5">
                      <span className="text-sm font-medium">{dashboard.name}</span>
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox
                          className="size-4 accent-brand-600"
                          checked={context.isDashboardVisibleForRole(dashboard, roleId)}
                          onChange={(event) => context.toggleDashboardVisibilityForRole(dashboard.id, roleId, event.target.checked)}
                        />
                        Visible pour ce rôle
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </SettingsTabContent>
        </SettingsTabs>
      ) : <p className="text-sm text-muted-foreground">Sélectionnez un rôle pour définir ses accès.</p>}
    </div>
  );
};

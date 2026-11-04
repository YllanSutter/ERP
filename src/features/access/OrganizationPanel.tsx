import React, { useState } from 'react';
import { OrganizationMembers } from './OrganizationMembers';
import { Download, RotateCcw, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { PluginManagerUI } from '@/components/admin/PluginManager';
import { DEFAULT_WORKSPACE_COLOR } from '@/lib/workspaceTheme';
import type { AccessContext } from './panelTypes';

type Props = { context: AccessContext };

export const OrganizationPanel = ({ context }: Props) => {
  const [accessOrganizationId, setAccessOrganizationId] = useState<string | null>(null);
  if (!context.organizations.length) return <p className="text-sm text-muted-foreground">Aucune organisation.</p>;

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {context.organizations.map((org) => {
        const isActive = context.activeOrganizationId === org.id;
        const savedColor = org.accent_color ?? DEFAULT_WORKSPACE_COLOR;
        return (
          <li key={org.id} className="px-2 py-1.5 sm:px-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <label
                className="relative size-8 shrink-0 cursor-pointer rounded-full border border-border focus-within:ring-2 focus-within:ring-brand-500"
                style={{ backgroundColor: context.organizationColorEdits[org.id] ?? savedColor }}
                title="Modifier la couleur"
              >
                <input
                  type="color"
                  aria-label={`Couleur du workspace ${org.name}`}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  value={context.organizationColorEdits[org.id] ?? savedColor}
                  onChange={(event) => context.updateOrganizationDraft(org.id, { accentColor: event.target.value })}
                  disabled={context.busy}
                />
              </label>
              <Input
                className="h-8 min-w-[7rem] flex-1 shadow-none"
                aria-label={`Nom du workspace ${org.name}`}
                title={`Identifiant : ${org.id}`}
                value={context.organizationNameEdits[org.id] ?? org.name}
                onChange={(event) => context.updateOrganizationDraft(org.id, { name: event.target.value })}
                disabled={context.busy}
              />
              {isActive && <span title="Organisation active" aria-label="Organisation active" role="img" className="size-2 shrink-0 rounded-full bg-brand-500" />}
              <IconButton
                label={accessOrganizationId === org.id ? `Masquer les accès à ${org.name}` : `Gérer les accès à ${org.name}`}
                aria-expanded={accessOrganizationId === org.id}
                className="size-8 aria-expanded:bg-brand-500/10 aria-expanded:text-brand-700 dark:aria-expanded:text-brand-300"
                onClick={() => setAccessOrganizationId((previous) => previous === org.id ? null : org.id)}
              ><Users /></IconButton>
              <IconButton
                label={`Supprimer l’organisation ${org.name}`}
                className="size-8 text-red-600 hover:text-red-700 dark:text-red-400"
                disabled={context.busy}
                onClick={() => context.deleteOrganization(org.id, org.name)}
              ><Trash2 /></IconButton>
            </div>
            {accessOrganizationId === org.id && <OrganizationMembers key={org.id} context={context} organization={org} />}
          </li>
        );
      })}
    </ul>
  );
};

export const BackupsPanel = ({ context }: Props) => (
  <div className="space-y-2">
    <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); void context.createBackup(); }}>
      <label className="min-w-36 flex-1">
        <span className="sr-only">Nom de la sauvegarde</span>
        <Input className="h-8" placeholder="Nom de la sauvegarde (facultatif)" value={context.backupLabel} onChange={(event) => context.setBackupLabel(event.target.value)} />
      </label>
      <Button type="submit" size="sm" disabled={context.backupBusy}>Créer une sauvegarde</Button>
      <Button type="button" size="sm" variant="outline" onClick={context.reloadBackups} disabled={context.backupBusy}>Actualiser</Button>
    </form>
    {context.visibleBackups.length === 0 ? (
      <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">Aucune sauvegarde disponible.</p>
    ) : (
      <ul className="divide-y divide-border rounded-xl border border-border">
        {context.visibleBackups.map((backup) => (
          <li key={backup.name} className="flex flex-wrap items-center gap-2 px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="break-all text-sm font-medium">{backup.name}</div>
              <div className="text-xs text-muted-foreground">
                {context.formatBytes(backup.size)} · {new Date(backup.createdAt).toLocaleString('fr-FR')}
              </div>
            </div>
            <div className="ml-auto flex items-center [&_button]:size-8">
              <IconButton label="Restaurer cette sauvegarde" onClick={() => context.restoreBackup(backup.name)} disabled={context.backupBusy}><RotateCcw /></IconButton>
              <IconButton label="Télécharger cette sauvegarde" onClick={() => context.downloadBackup(backup.name)}><Download /></IconButton>
              <IconButton label="Supprimer cette sauvegarde" className="text-red-600 hover:text-red-700 dark:text-red-400" onClick={() => context.deleteBackup(backup.name)} disabled={context.backupBusy}><Trash2 /></IconButton>
            </div>
          </li>
        ))}
      </ul>
    )}
    {context.sortedBackups.length > 10 && <p className="text-xs text-muted-foreground">Les dix sauvegardes les plus récentes sont affichées.</p>}
  </div>
);

export const PluginsPanel = ({ context }: Props) => (
  <PluginManagerUI
    organizationId={context.activeOrganizationId || 'default'}
    collectionProperties={context.collections[0]?.properties || []}
    collections={context.collections}
  />
);

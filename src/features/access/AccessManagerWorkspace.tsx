import React, { useState } from 'react';
import { Building2, DatabaseBackup, FolderInput, KeyRound, Puzzle, RefreshCw, Save, Shield, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { IconButton } from '@/components/ui/icon-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccessManagerController } from './useAccessManagerController';
import { DataTransferPanel } from './DataTransferPanel';
import { BackupsPanel, OrganizationPanel, PluginsPanel } from './OrganizationPanel';
import { PermissionsPanel } from './PermissionsPanel';
import { UsersPanel } from './UsersPanel';
import { ImportMappingPanel } from './ImportMappingPanel';

const sections = [
  { id: 'organization', label: 'Organisations', icon: Building2, Panel: OrganizationPanel },
  { id: 'users', label: 'Utilisateurs', icon: Users, Panel: UsersPanel },
  { id: 'permissions', label: 'Permissions', icon: KeyRound, Panel: PermissionsPanel },
  { id: 'plugins', label: 'Plugins', icon: Puzzle, Panel: PluginsPanel },
  { id: 'backups', label: 'Sauvegardes', icon: DatabaseBackup, Panel: BackupsPanel },
  { id: 'transfer', label: 'Import et export', icon: FolderInput, Panel: DataTransferPanel },
] as const;

type AccessManagerWorkspaceProps = {
  collections: any[];
  dashboards: any[];
  onClose: () => void;
  onImportCollections?: (collections: any[]) => void;
  onUpdateDashboards?: (dashboards: any[]) => void;
};

const AccessManagerWorkspace = (props: AccessManagerWorkspaceProps) => {
  const { isAdmin, panelContext } = useAccessManagerController(props);
  const [activeSection, setActiveSection] = useState<string>('organization');
  const isMobile = useIsMobile();
  if (!isAdmin) return null;

  const organization = panelContext.organizations.find((org) => org.id === panelContext.activeOrganizationId);

  return (
    <Dialog open onOpenChange={(open) => {
      if (open || panelContext.savingSettings || panelContext.importCommitBusy) return;
      if (!panelContext.pendingSettingsCount || window.confirm('Fermer et abandonner les modifications en cours ?')) props.onClose();
    }}>
      <DialogContent className="flex h-[100dvh] max-w-none flex-col gap-0 overflow-hidden p-0 sm:h-[min(850px,92dvh)] sm:w-[calc(100%_-_2rem)] sm:max-w-6xl sm:rounded-2xl motion-reduce:animate-none">
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 pr-12 sm:px-4 sm:pr-12">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
            <Shield size={16} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base">Comptes & Permissions</DialogTitle>
            <DialogDescription className="truncate text-xs">{organization?.name || 'Paramètres du workspace'}</DialogDescription>
          </div>
          <IconButton label="Actualiser les paramètres" onClick={panelContext.loadAll} disabled={panelContext.loading || panelContext.savingSettings}>
            <RefreshCw className={panelContext.loading ? 'motion-safe:animate-spin' : undefined} />
          </IconButton>
        </header>

        <Tabs value={activeSection} onValueChange={setActiveSection} orientation={isMobile ? 'horizontal' : 'vertical'} className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="shrink-0 overflow-x-auto border-b border-border px-3 md:w-44 md:overflow-y-auto md:border-b-0 md:border-r md:bg-muted/30 md:p-2">
            <TabsList aria-label="Sections des paramètres" className="h-auto min-w-max justify-start gap-1 rounded-none bg-transparent p-0 md:flex md:min-w-0 md:flex-col md:items-stretch">
              {sections.map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="gap-2 rounded-none border-b-2 border-transparent px-2.5 py-2 text-sm data-[state=active]:border-brand-500 data-[state=active]:bg-transparent data-[state=active]:text-brand-700 data-[state=active]:shadow-none dark:data-[state=active]:text-brand-300 md:justify-start md:rounded-lg md:border-0 md:py-1.5 md:hover:bg-muted md:data-[state=active]:bg-brand-500/10"
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {sections.map(({ id, label, Panel }) => (
            <TabsContent key={id} value={id} forceMount={id === 'plugins' ? true : undefined} className="m-0 min-h-0 min-w-0 flex-1 data-[state=inactive]:hidden overflow-y-auto overscroll-contain rounded-none border-0 px-3 py-2 sm:px-4 sm:py-3">
              <fieldset disabled={panelContext.savingSettings} className="mx-auto min-w-0 w-full max-w-4xl">
                <legend className="sr-only">{label}</legend>
                {id === 'transfer' && panelContext.showImportMapper
                  ? <ImportMappingPanel context={panelContext} />
                  : <Panel context={panelContext} />}
              </fieldset>
            </TabsContent>
          ))}
        </Tabs>
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-background px-3 py-2 sm:px-4">
          <p role="status" className={`text-xs sm:text-sm ${panelContext.settingsNotice?.error ? 'text-destructive' : 'text-muted-foreground'}`}>
            {panelContext.settingsNotice?.message || (panelContext.pendingSettingsCount
              ? 'Modifications en attente'
              : '')}
          </p>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={panelContext.saveAllSettings}
            disabled={!panelContext.pendingSettingsCount || panelContext.savingSettings || panelContext.loading || panelContext.busy}
          >
            <Save /> {panelContext.savingSettings ? 'Enregistrement…' : 'Tout enregistrer'}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
};

export default AccessManagerWorkspace;

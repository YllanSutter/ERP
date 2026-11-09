import React, { useState } from 'react';
import { Building2, DatabaseBackup, FolderInput, KeyRound, Puzzle, RefreshCw, Save, Shield, Users } from 'lucide-react';
import { SettingsDialog, SettingsTabs, SettingsTabContent, SettingsFooter } from '@/components/ui/settings-panel';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
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
  onSaveSteamExchangeLabels?: Parameters<typeof useAccessManagerController>[0]['onSaveSteamExchangeLabels'];
};

const AccessManagerWorkspace = (props: AccessManagerWorkspaceProps) => {
  const { isAdmin, panelContext } = useAccessManagerController(props);
  const [activeSection, setActiveSection] = useState<string>('organization');
  if (!isAdmin) return null;

  const organization = panelContext.organizations.find((org) => org.id === panelContext.activeOrganizationId);

  return (
    <SettingsDialog open workspace title="Comptes & Permissions" description={organization?.name || 'Paramètres du workspace'} icon={Shield}
      actions={
        <IconButton label="Actualiser les paramètres" onClick={panelContext.loadAll} disabled={panelContext.loading || panelContext.savingSettings}>
          <RefreshCw className={panelContext.loading ? 'motion-safe:animate-spin' : undefined} />
        </IconButton>
      }
      onOpenChange={(open) => {
      if (open || panelContext.savingSettings || panelContext.importCommitBusy) return;
      if (!panelContext.pendingSettingsCount || window.confirm('Fermer et abandonner les modifications en cours ?')) props.onClose();
    }}>
        <SettingsTabs value={activeSection} onValueChange={setActiveSection} navigation="side" items={sections}>
          {sections.map(({ id, label, Panel }) => (
            <SettingsTabContent key={id} value={id} forceMount={id === 'plugins' ? true : undefined} >
              <fieldset disabled={panelContext.savingSettings} className="mx-auto min-w-0 w-full max-w-4xl">
                <legend className="sr-only">{label}</legend>
                {id === 'transfer' && panelContext.showImportMapper
                  ? <ImportMappingPanel context={panelContext} />
                  : <Panel context={panelContext} />}
              </fieldset>
            </SettingsTabContent>
          ))}
        </SettingsTabs>
        <SettingsFooter spread>
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
        </SettingsFooter>
    </SettingsDialog>
  );
};

export default AccessManagerWorkspace;

import React from 'react';
import type { ViewSettingsProps } from '@/lib/views';
import type { GroupTotalConfig } from '@/lib/types';
import { SettingsSelect, SettingsToggle } from '@/components/ui/settings-panel';
import { TotalsSettings } from './TotalsSettings';
import { resolveTotalsScope } from './totalsScope';

export default function ViewTotalsSettings({ view, properties, onUpdate }: Pick<ViewSettingsProps, 'view' | 'properties' | 'onUpdate'>) {
  const groups = Array.isArray(view.groups) ? view.groups as string[] : [];
  const groupedTable = view.type === 'table' && groups.length > 0;
  const scope = resolveTotalsScope(view.totalsScope, groupedTable, view.totalsPosition as string | undefined);
  const configs = (view.groupTotalsByGroupId || {}) as Record<string, GroupTotalConfig>;
  return <div className="space-y-4">
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <h3 className="text-sm font-semibold">Affichage des totaux</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{view.type === 'kanban'
        ? 'Les calculs ci-dessous s’appliquent à chaque colonne. Le bouton Σ d’une colonne permet de personnaliser ses totaux.'
        : 'Le total général porte sur toutes les lignes filtrées. Les sous-totaux portent uniquement sur les lignes de chaque groupe.'}</p>
      {groupedTable && <SettingsSelect aria-label="Totaux à afficher" value={scope} options={[
        { value: 'view', label: 'Total général uniquement' },
        { value: 'groups', label: 'Sous-totaux par groupe uniquement' },
        { value: 'both', label: 'Total général et sous-totaux' },
      ]} onChange={(totalsScope) => onUpdate({ totalsScope })} />}
    </div>
    <TotalsSettings properties={properties} totalFields={(view.totalFields || {}) as Record<string, string>}
      position={String(view.totalsPosition || (view.type === 'kanban' ? 'none' : 'bottom'))}
      showPosition={!groupedTable || scope !== 'groups'}
      positionLabel={view.type === 'table' ? 'Position du total général' : 'Position dans les colonnes'}
      onChange={onUpdate} />
    {groupedTable && scope !== 'view' && <section className="space-y-3 rounded-lg border border-border p-3">
      <h3 className="text-sm font-semibold">Sous-totaux par niveau</h3>
      <p className="text-xs text-muted-foreground">Les mêmes champs et calculs sont utilisés à tous les niveaux. La position de chaque niveau se règle ci-dessous.</p>
      {groups.map((id, index) => {
        const config = configs[id] || {};
        return <div key={id} className="space-y-2 border-t border-border pt-3">
          <SettingsToggle label={`Niveau ${index + 1} · ${properties.find((property) => property.id === id)?.name || id}`}
            checked={config.enabled !== false}
            onChange={(enabled) => onUpdate({ groupTotalsByGroupId: { ...configs, [id]: { ...config, enabled } } })} />
          <SettingsSelect aria-label={`Position du sous-total niveau ${index + 1}`} value={config.position || 'bottom'} disabled={config.enabled === false}
            options={[{ value: 'top', label: 'En haut' }, { value: 'bottom', label: 'En bas' }, { value: 'both', label: 'En haut et en bas' }]}
            onChange={(position) => onUpdate({ groupTotalsByGroupId: { ...configs, [id]: { ...config, position } } })} />
        </div>;
      })}
    </section>}
  </div>;
}

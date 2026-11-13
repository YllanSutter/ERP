import React from 'react';
import type { ViewSettingsProps } from '@/lib/views';
import type { GroupTotalConfig } from '@/lib/types';
import { SettingsSelect } from '@/components/ui/settings-panel';
import { TotalsSettings } from './TotalsSettings';
import { resolveTotalsScope } from './totalsScope';

export default function ViewTotalsSettings({ view, properties, onUpdate, items = [], collections = [] }: Pick<ViewSettingsProps, 'view' | 'properties' | 'onUpdate' | 'collections'> & { items?: any[] }) {
  const groups = Array.isArray(view.groups) ? view.groups as string[] : [];
  const groupedTable = view.type === 'table' && groups.length > 0;
  const scope = groupedTable && !view.totalsAlwaysVisible ? 'groups' : resolveTotalsScope(view.totalsScope, groupedTable, view.totalsPosition as string | undefined);
  const configs = (view.groupTotalsByGroupId || {}) as Record<string, GroupTotalConfig>;
  return <div className="space-y-3 [--settings-control-height:2rem]">
    <div className="space-y-2">
      {['table', 'kanban'].includes(view.type) && <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={Boolean(view.totalsAlwaysVisible)}
          onChange={(event) => onUpdate({ totalsAlwaysVisible: event.target.checked, ...(view.type === 'table' && event.target.checked && view.totalsScope !== 'view' ? { totalsScope: 'both' } : {}) })} />
        Afficher dans tous les cas
      </label>}
      {groupedTable && view.totalsAlwaysVisible === true && <SettingsSelect aria-label="Totaux à afficher" value={scope} options={[
        { value: 'view', label: 'Total général uniquement' },
        { value: 'groups', label: 'Sous-totaux par groupe uniquement' },
        { value: 'both', label: 'Total général et sous-totaux' },
      ]} onChange={(totalsScope) => onUpdate({ totalsScope })} />}
    </div>
    {groupedTable && scope !== 'view' && <section className="overflow-hidden rounded-lg border border-border">
      <h3 className="bg-muted/40 px-2 py-1.5 text-xs font-semibold">Sous-totaux par niveau</h3>
      <div className="divide-y divide-border">
        {groups.map((id, index) => {
          const config = configs[id] || {};
          const name = properties.find((property) => property.id === id)?.name || id;
          return <div key={id} className="grid grid-cols-[minmax(0,1fr)_11.75rem] items-center gap-2 px-2 py-1.5">
            <label className="flex min-w-0 cursor-pointer items-center gap-2 text-xs" title={`Niveau ${index + 1} · ${name}`}>
              <input type="checkbox" className="size-4 shrink-0 accent-primary" aria-label={`Afficher le sous-total · ${name}`}
                checked={config.enabled !== false}
                onChange={(event) => onUpdate({ groupTotalsByGroupId: { ...configs, [id]: { ...config, enabled: event.target.checked } } })} />
              <span className="shrink-0 text-muted-foreground">{index + 1}.</span><span className="truncate">{name}</span>
            </label>
            <SettingsSelect aria-label={`Position du sous-total niveau ${index + 1}`} value={config.position || 'bottom'} disabled={config.enabled === false}
              options={[{ value: 'top', label: 'En haut' }, { value: 'bottom', label: 'En bas' }, { value: 'both', label: 'Haut et bas' }]}
              onChange={(position) => onUpdate({ groupTotalsByGroupId: { ...configs, [id]: { ...config, position } } })} />
          </div>;
        })}
      </div>
    </section>}
    <TotalsSettings hiddenFields={Array.isArray(view.hiddenFields) ? view.hiddenFields : []} fieldVisibility={(view.totalsFieldVisibility || {}) as Record<string, boolean>} properties={properties} items={items} collections={collections} totalFields={(view.totalFields || {}) as Record<string, string>}
      position={String(view.totalsPosition || (view.type === 'kanban' ? 'none' : 'bottom'))}
      showPosition={!groupedTable || scope !== 'groups'}
      positionLabel={view.type === 'table' ? 'Position générale' : 'Position des totaux'}
      onChange={onUpdate} />
  </div>;
}

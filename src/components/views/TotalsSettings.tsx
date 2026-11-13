import React from 'react';
import type { ViewSettingsProps } from '@/lib/views';
import { SettingsSelect, SettingsLabel } from '@/components/ui/settings-panel';

const TotalsSelect = ({ label, ...props }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) => <label className="grid gap-1 text-xs"><SettingsLabel>{label}</SettingsLabel><SettingsSelect {...props} aria-label={label} /></label>;

const totalOptionsForProperty = (property: { type: string }) => [
  { value: 'none', label: 'Aucun' },
  ...(property.type === 'number' ? [{ value: 'sum', label: 'Somme' }, { value: 'avg', label: 'Moyenne' }, { value: 'min', label: 'Minimum' }, { value: 'max', label: 'Maximum' }] : []),
  ...(property.type === 'checkbox' ? [{ value: 'count-true', label: 'Nombre cochés' }, { value: 'count-false', label: 'Nombre décochés' }] : []),
  ...(property.type === 'relation' ? [{ value: 'count-linked', label: 'Nombre liés' }] : []),
  { value: 'count', label: 'Nombre de lignes' }, { value: 'unique', label: 'Valeurs uniques' },
];

export const TotalsSettings = ({ properties, totalFields, position, onChange, showPosition = true, positionLabel = 'Position des totaux' }: {
  properties: ViewSettingsProps['properties']; totalFields: Record<string, string>; position: string; showPosition?: boolean; positionLabel?: string;
  onChange: (patch: { totalFields?: Record<string, string>; totalsPosition?: string }) => void;
}) => <div className="min-w-0 space-y-4 p-3">
  {showPosition && <TotalsSelect label={positionLabel} value={position} options={[
    { value: 'none', label: 'Masqués' }, { value: 'top', label: 'En haut' },
    { value: 'bottom', label: 'En bas' }, { value: 'both', label: 'En haut et en bas' },
  ]} onChange={(value) => onChange({ totalsPosition: value })} />}
  <section className="overflow-hidden rounded-lg border border-border" aria-label="Champs à totaliser">
    <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-2">
      <h3 className="text-sm font-semibold">Champs à totaliser</h3>
      <span className="shrink-0 text-xs text-muted-foreground">{properties.filter((property) => totalFields[property.id]).length} actifs</span>
    </div>
    <div className="divide-y divide-border">
      {properties.map((property) => <div key={property.id} className="grid min-w-0 grid-cols-1 items-center gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <span className="break-words text-sm font-medium" title={property.name}>{property.name}</span>
        <SettingsSelect aria-label={`Total · ${property.name}`} value={totalFields[property.id] || 'none'}
          options={totalFields[property.id] && !totalOptionsForProperty(property).some(({ value }) => value === totalFields[property.id])
            ? [...totalOptionsForProperty(property), { value: totalFields[property.id], label: 'Calcul personnalisé' }]
            : totalOptionsForProperty(property)}
          onChange={(value) => {
            const next = { ...totalFields };
            if (value === 'none') delete next[property.id]; else next[property.id] = value;
            onChange({ totalFields: next });
          }} />
      </div>)}
      {!properties.length && <p className="p-3 text-sm text-muted-foreground">Aucun champ accessible.</p>}
    </div>
  </section>
</div>;

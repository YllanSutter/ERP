import React from 'react';
import type { ViewSettingsProps } from '@/lib/views';
import { SettingsSelect, SettingsLabel } from '@/components/ui/settings-panel';

const TotalsSelect = ({ label, ...props }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) => <label className="grid gap-1 text-xs"><SettingsLabel>{label}</SettingsLabel><SettingsSelect {...props} aria-label={label} /></label>;

export const totalOptionsForProperty = (property: { type: string }) => [
  { value: 'none', label: 'Aucun' },
  ...(property.type === 'number' ? [{ value: 'sum', label: 'Somme' }, { value: 'avg', label: 'Moyenne' }, { value: 'min', label: 'Minimum' }, { value: 'max', label: 'Maximum' }] : []),
  ...(property.type === 'checkbox' ? [{ value: 'count-true', label: 'Nombre cochés' }, { value: 'count-false', label: 'Nombre décochés' }] : []),
  ...(property.type === 'relation' ? [{ value: 'count-linked', label: 'Nombre liés' }] : []),
  { value: 'count', label: 'Nombre de lignes' }, { value: 'unique', label: 'Valeurs uniques' },
];

export const TotalsSettings = ({ properties, totalFields, position, onChange }: {
  properties: ViewSettingsProps['properties']; totalFields: Record<string, string>; position: string;
  onChange: (patch: { totalFields?: Record<string, string>; totalsPosition?: string }) => void;
}) => <div className="grid gap-2 border-t border-border pt-3 sm:col-span-2">
  <TotalsSelect label="Position des totaux" value={position} options={[
    { value: 'none', label: 'Masqués' }, { value: 'top', label: 'En haut' },
    { value: 'bottom', label: 'En bas' }, { value: 'both', label: 'En haut et en bas' },
  ]} onChange={(value) => onChange({ totalsPosition: value })} />
  {properties.map((property) => <TotalsSelect key={property.id} label={`Total · ${property.name}`}
    value={totalFields[property.id] || 'none'} options={totalOptionsForProperty(property)}
    onChange={(value) => {
      const next = { ...totalFields };
      if (value === 'none') delete next[property.id]; else next[property.id] = value;
      onChange({ totalFields: next });
    }} />)}
</div>;


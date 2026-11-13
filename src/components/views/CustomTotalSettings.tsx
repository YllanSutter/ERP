import { SlidersHorizontal } from 'lucide-react';
import React, { useId, useState } from 'react';
import type { Property } from '@/lib/types';
import { SettingsDialog, SettingsSelect } from '@/components/ui/settings-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function readFilteredTotal(value: string) {
  const parts = value.split(':');
  if (parts[0] !== 'number-filter' || parts.length < 4) return null;
  try { return { base: parts[1], field: parts[2], value: decodeURIComponent(parts.slice(3).join(':')) }; }
  catch { return null; }
}

export function CustomTotalForm({ property, properties, items = [], collections = [], value, onApply }: {
  property: Property; properties: Property[]; items?: any[]; collections?: any[]; value: string; onApply: (value: string) => void;
}) {
  const filtered = readFilteredTotal(value);
  const candidates = properties.filter((candidate) => candidate.id !== property.id && !candidate.isRelationLinkedColumn);
  const numbers = properties.filter((candidate) => candidate.type === 'number');
  const [base, setBase] = useState(filtered?.base || 'sum');
  const [field, setField] = useState(filtered?.field || candidates[0]?.id || '');
  const [excludedValue, setExcludedValue] = useState(filtered?.value || '');
  const [linkedField, setLinkedField] = useState(value.startsWith('linked-progress:') ? value.slice('linked-progress:'.length) : numbers[0]?.id || '');
  const listId = useId();
  const filterProperty = properties.find((candidate) => candidate.id === field);
  const optionLabels = new Map<string, string>((filterProperty?.options || []).map((option: any) => typeof option === 'string' ? [option, option] : [String(option.value), option.label || option.value]));
  if (filterProperty?.type === 'relation') {
    const target = collections.find((collection) => collection.id === filterProperty.relation?.targetCollectionId);
    for (const item of target?.items || []) {
      const fields = filterProperty.relation?.displayFieldIds?.length ? filterProperty.relation.displayFieldIds : ['name'];
      optionLabels.set(String(item.id), fields.map((id: string) => item[id]).filter(Boolean).join(' · ') || item.name || String(item.id));
    }
  }
  if (filterProperty?.type === 'checkbox') { optionLabels.set('true', 'Oui'); optionLabels.set('false', 'Non'); }
  const options = Array.from(optionLabels.keys());
  const values = [...new Set([...options, ...items.flatMap((item) => {
    const raw = item[field];
    return Array.isArray(raw) ? raw : [raw?.value ?? raw];
  })].filter((entry) => entry != null).map(String))];
  if (property.type === 'checkbox') return <div className="space-y-3 p-3">
    <p className="text-xs text-muted-foreground">Répartir le montant d’un champ numérique entre les éléments cochés et non cochés (payé / restant).</p>
    <SettingsSelect aria-label="Champ du montant" value={linkedField} options={numbers.map((candidate) => ({ value: candidate.id, label: candidate.name }))} onChange={setLinkedField} />
    <Button type="button" size="sm" disabled={!linkedField} onClick={() => onApply(`linked-progress:${linkedField}`)}>Appliquer le calcul</Button>
  </div>;
  return <div className="space-y-3 p-3">
    <p className="text-xs text-muted-foreground">Calculer le total en excluant les lignes où le champ choisi correspond à la valeur indiquée.</p>
    <label className="grid gap-1 text-xs">Calcul<SettingsSelect aria-label="Calcul personnalisé" value={base} onChange={setBase}
      options={[{ value: 'sum', label: 'Somme' }, { value: 'avg', label: 'Moyenne' }, { value: 'min', label: 'Minimum' }, { value: 'max', label: 'Maximum' }]} /></label>
    <label className="grid gap-1 text-xs">Exclure si le champ<SettingsSelect aria-label="Champ à exclure" value={field}
      options={candidates.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
      onChange={(next) => { setField(next); setExcludedValue(''); }} /></label>
    <label className="grid gap-1 text-xs">Est égal à<Input aria-label="Valeur à exclure" value={excludedValue} list={listId} onChange={(event) => setExcludedValue(event.target.value)} placeholder="Choisir ou saisir une valeur" /></label>
    <datalist id={listId}>{values.map((entry) => <option key={entry} value={entry}>{optionLabels.get(entry) || entry}</option>)}</datalist>
    <Button type="button" size="sm" disabled={!field || !excludedValue} onClick={() => onApply(`number-filter:${base}:${field}:${encodeURIComponent(excludedValue)}`)}>Appliquer le calcul</Button>
  </div>;
}

export function CustomTotalDialog({ property, properties, items, collections, value, onChange, onClose }: {
  property: Property | null; properties: Property[]; items?: any[]; collections?: any[]; value: string;
  onChange: (value: string) => void; onClose: () => void;
}) {
  return <SettingsDialog open={Boolean(property)} onOpenChange={(open) => { if (!open) onClose(); }} layer={450}
    title={`Calcul personnalisé · ${property?.name || ''}`}>
    {property && <CustomTotalForm key={`${property.id}:${value}`} property={property} properties={properties} items={items} collections={collections} value={value}
      onApply={(next) => { onChange(next); onClose(); }} />}
  </SettingsDialog>;
}

export default function CustomTotalSettings(props: Omit<React.ComponentProps<typeof CustomTotalForm>, 'onApply'> & { onChange: (value: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant="ghost" size="sm" className={props.compact ? 'size-7 shrink-0 p-1 text-muted-foreground' : 'h-auto justify-start px-0 py-1 text-xs text-primary'}
      aria-label={`Calcul personnalisé · ${props.property.name}`} title="Calcul personnalisé" onClick={() => setOpen(true)}>{props.compact ? <SlidersHorizontal size={14} /> : 'Calcul personnalisé…'}</Button>
    <CustomTotalDialog {...props} property={open ? props.property : null} onClose={() => setOpen(false)} />
  </>;
}

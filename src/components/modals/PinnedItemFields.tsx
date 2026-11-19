import React from 'react';
import { Pin, PinOff } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PinnedItemField } from '@/lib/hooks/usePinnedItemFields';

export function PinnedFieldsSettings({ properties, fields, onChange }: {
  properties: any[]; fields: PinnedItemField[];
  onChange: (id: string, pinned: boolean, keepOriginal?: boolean) => void;
}) {
  return <Popover>
    <PopoverTrigger asChild>
      <button type="button" className="rounded-lg p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        aria-label="Configurer les champs épinglés" title="Champs épinglés"><Pin size={15} /></button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-3">
      <div className="mb-1 text-sm font-semibold">Champs épinglés</div>
      <p className="mb-3 text-xs text-muted-foreground">Visibles en haut de la fiche dans tous les onglets.</p>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {!properties.length && <p className="text-xs text-muted-foreground">Aucun champ supplémentaire.</p>}
        {properties.map(property => {
          const pinned = fields.find(field => field.id === property.id);
          return <div key={property.id} className="rounded-md border border-border p-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input type="checkbox" checked={Boolean(pinned)} onChange={event => onChange(property.id, event.target.checked)} />
              <span className="min-w-0 truncate">{property.name}</span>
            </label>
            {pinned && <label className="mt-2 flex cursor-pointer items-center gap-2 pl-5 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={pinned.keepOriginal} onChange={event => onChange(property.id, true, event.target.checked)} />
              Garder aussi à l’emplacement d’origine
            </label>}
          </div>;
        })}
      </div>
    </PopoverContent>
  </Popover>;
}

export function PinnedFieldsHeader({ properties, onUnpin, renderField }: {
  properties: any[]; onUnpin: (id: string) => void; renderField: (property: any) => React.ReactNode;
}) {
  if (!properties.length) return null;
  return <div aria-label="Champs épinglés" className="flex min-w-0 flex-wrap items-start gap-2">
    {properties.map(property => <div key={property.id} className="min-w-40 max-w-full flex-1 rounded-lg border border-border bg-background/70 px-2.5 py-1.5 sm:max-w-80">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-medium text-muted-foreground">
        <span className="truncate">{property.name}</span>
        <button type="button" aria-label={`Désépingler ${property.name}`} title="Désépingler" className="shrink-0 hover:text-foreground" onClick={() => onUnpin(property.id)}><PinOff size={11} /></button>
      </div>
      <div className="min-w-0 overflow-x-auto">{renderField(property)}</div>
    </div>)}
  </div>;
}

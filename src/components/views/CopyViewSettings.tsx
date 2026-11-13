import React, { useState } from 'react';
import type { ViewDefinition } from '@/lib/views';
import { SettingsSelect } from '@/components/ui/settings-panel';
import { Button } from '@/components/ui/button';
import { COPY_CATEGORIES, copyViewSettings, type CopySelection } from './copyViewSettings';

export default function CopyViewSettings({ view, views, onUpdate }: {
  view: ViewDefinition; views: ViewDefinition[]; onUpdate: (patch: Record<string, unknown>) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [selection, setSelection] = useState<CopySelection>({ filters: true, groups: true, totals: true, settings: true });
  const [copied, setCopied] = useState(false);
  const candidates = views.filter((candidate) => candidate.id !== view.id);
  const source = candidates.find((candidate) => candidate.id === sourceId);
  return <section className="mt-4 space-y-3 border-t border-border pt-4">
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input type="checkbox" className="size-4 accent-primary" checked={enabled} onChange={(event) => { setEnabled(event.target.checked); setCopied(false); }} />
      Copier les paramètres d’une autre vue
    </label>
    {enabled && <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">Choisissez une vue de cette collection et les catégories à reprendre. Les catégories cochées seront remplacées.</p>
      {candidates.length ? <SettingsSelect aria-label="Vue source" value={source?.id || ''} placeholder="Choisir une vue"
        options={candidates.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
        onChange={(id) => { setSourceId(id); setCopied(false); }} /> : <p className="text-xs text-muted-foreground">Aucune autre vue dans cette collection.</p>}
      <div className="grid grid-cols-2 gap-3">
        {COPY_CATEGORIES.map(({ id, label }) => <label key={id} className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={selection[id]}
            onChange={(event) => { setSelection((previous) => ({ ...previous, [id]: event.target.checked })); setCopied(false); }} />
          {label}
        </label>)}
      </div>
      <Button type="button" size="sm" disabled={!source || !Object.values(selection).some(Boolean)} onClick={() => {
        if (!source) return;
        onUpdate(copyViewSettings(source, view, selection));
        setCopied(true);
      }}>Copier les catégories cochées</Button>
      {copied && <p role="status" className="text-xs text-muted-foreground">Paramètres copiés.</p>}
    </div>}
  </section>;
}

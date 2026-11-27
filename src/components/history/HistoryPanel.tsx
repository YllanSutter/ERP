import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, History, LoaderCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatValueForDisplay } from '@/components/modals/modalLib';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type HistoryChange = {
  fieldId: string;
  label: string;
  beforeExists: boolean;
  before: any;
  afterExists: boolean;
  after: any;
};

type HistoryEvent = {
  id: string;
  entityType: 'collection' | 'item' | 'view';
  entityId: string;
  entityLabel: string;
  action: 'created' | 'updated' | 'deleted' | 'restored';
  actorName: string;
  source: string;
  createdAt: string;
  changes: HistoryChange[];
  canUndo: boolean;
};

interface HistoryPanelProps {
  collectionId: string;
  itemId?: string;
  title?: string;
}

const actionLabel: Record<HistoryEvent['action'], string> = {
  created: 'a créé',
  updated: 'a modifié',
  deleted: 'a supprimé',
  restored: 'a restauré',
};
const sourceLabel: Record<string, string> = {
  undo: 'annulation',
  import: 'import',
  steam: 'mise à jour Steam',
};

function displayValue(exists: boolean, value: any) {
  return exists ? formatValueForDisplay(value) : '—';
}

function displayChangeValue(change: HistoryChange, exists: boolean, value: any) {
  if (!exists) return '—';
  if (change.fieldId === 'properties' && Array.isArray(value)) {
    return value.map(property => {
      const flags = [property.required ? 'obligatoire' : '', Array.isArray(property.options) && property.options.length ? `options: ${property.options.map((option: any) => typeof option === 'string' ? option : option.label || option.value).join('/')}` : ''].filter(Boolean);
      return `${property.name || property.id} (${property.type || 'champ'}${flags.length ? `, ${flags.join(', ')}` : ''})`;
    }).join(' · ') || 'Aucun champ';
  }
  if (change.fieldId === 'collectionTemplates' && Array.isArray(value)) {
    return value.map(template => `${template.name || 'Template'} : ${(template.fieldNames || template.fieldIds || []).join(', ') || 'aucun champ'}${Object.keys(template.values || {}).length ? ` · valeurs ${JSON.stringify(template.values)}` : ''}${Object.keys(template.dateDefaults || {}).length ? ` · dates ${JSON.stringify(template.dateDefaults)}` : ''}`).join(' · ') || 'Aucun template';
  }
  if (change.fieldId === 'fieldGroups' && Array.isArray(value)) {
    return value.map(group => `${group.label || group.name || 'Groupe'} : ${(group.fieldNames || group.fieldIds || []).join(', ') || 'aucun champ'}`).join(' · ') || 'Aucun groupe';
  }
  if (Array.isArray(value) && value.every(entry => typeof entry === 'string')) return value.join(', ') || 'Aucun';
  return displayValue(exists, value);
}

export default function HistoryPanel({ collectionId, itemId, title }: HistoryPanelProps) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [undoingId, setUndoingId] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (nextCursor?: string | null, append = false) => {
    const params = new URLSearchParams({ limit: '30' });
    if (!itemId) params.set('collectionId', collectionId);
    if (nextCursor) params.set('cursor', nextCursor);
    const path = itemId
      ? `${API_URL}/history/items/${encodeURIComponent(itemId)}?${params}`
      : `${API_URL}/history/collections/${encodeURIComponent(collectionId)}?${params}`;
    try {
      setError('');
      if (append) setLoadingMore(true); else setLoading(true);
      const response = await fetch(path, { credentials: 'include' });
      if (!response.ok) throw new Error('Impossible de charger l’historique.');
      const result = await response.json();
      setEvents(previous => append ? [...previous, ...(result.events || [])] : (result.events || []));
      setCursor(result.nextCursor || null);
    } catch (loadError: any) {
      setError(loadError?.message || 'Impossible de charger l’historique.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [collectionId, itemId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onHistoryUpdated = () => { void load(); };
    window.addEventListener('erp-history-updated', onHistoryUpdated);
    return () => window.removeEventListener('erp-history-updated', onHistoryUpdated);
  }, [load]);

  const undo = async (event: HistoryEvent) => {
    if (!window.confirm(`Annuler cette modification de « ${event.entityLabel} » ?`)) return;
    setUndoingId(event.id);
    setNotice('');
    try {
      const response = await fetch(`${API_URL}/history/events/${encodeURIComponent(event.id)}/undo`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 409
        ? 'Cet objet a changé depuis cette version. Annule d’abord ses modifications plus récentes.'
        : result.error || 'Annulation impossible.');
      setNotice(`Modification de « ${event.entityLabel} » annulée.`);
      await load();
    } catch (undoError: any) {
      setNotice(undoError?.message || 'Annulation impossible.');
    } finally {
      setUndoingId('');
    }
  };

  if (loading) return <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><LoaderCircle size={15} className="animate-spin" />Chargement de l’historique…</div>;

  return <section className="space-y-3 p-4 sm:p-6" aria-label={title || 'Historique'}>
    <header>
      <h2 className="text-base font-semibold">{title || 'Historique'}</h2>
      <p className="mt-1 text-xs text-muted-foreground">Modifications enregistrées sur le serveur.</p>
    </header>
    {error && <div role="alert" className="flex items-center gap-2 text-sm text-destructive"><AlertCircle size={15} />{error}<Button size="sm" variant="outline" onClick={() => void load()}>Réessayer</Button></div>}
    {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
    {!error && events.length === 0 && <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><History size={16} />Aucune modification enregistrée depuis l’activation du nouvel historique.</div>}
    <ol className="space-y-2">
      {events.map(event => <li key={event.id} className="rounded-lg border border-border/70 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium">
              <span>{event.actorName}</span> {actionLabel[event.action]} <span className="break-words">{event.entityLabel || 'la collection'}</span>
            </div>
            <time className="text-[11px] text-muted-foreground" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('fr-FR')}</time>
            {sourceLabel[event.source] && <span className="ml-2 text-[11px] text-muted-foreground">· {sourceLabel[event.source]}</span>}
          </div>
          {event.canUndo && <Button size="sm" variant="outline" disabled={undoingId === event.id} onClick={() => void undo(event)}>
            {undoingId === event.id ? <LoaderCircle size={13} className="animate-spin" /> : <RotateCcw size={13} />}
            Annuler cet objet
          </Button>}
        </div>
        {event.changes.length > 0 && <ul className="mt-3 space-y-1.5">
          {event.changes.map(change => <li key={change.fieldId} className="grid gap-1 text-xs sm:grid-cols-[minmax(100px,0.6fr)_1fr]">
            <span className="font-medium text-muted-foreground">{change.label}</span>
            <span className="break-words"><span className="text-muted-foreground">{displayChangeValue(change, change.beforeExists, change.before)}</span><span className="px-1.5 text-muted-foreground">→</span><span>{displayChangeValue(change, change.afterExists, change.after)}</span></span>
          </li>)}
        </ul>}
      </li>)}
    </ol>
    {cursor && <div className="flex justify-center"><Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void load(cursor, true)}>
      {loadingMore && <LoaderCircle size={13} className="animate-spin" />}Charger la suite
    </Button></div>}
  </section>;
}

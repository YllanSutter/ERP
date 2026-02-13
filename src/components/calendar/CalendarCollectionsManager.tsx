import React, { useState } from 'react';
import MonthView from '../CalendarView/MonthView';
import WeekView from '../CalendarView/WeekView';
import { 
  moveAllSegmentsOfItem, 
  updateSegmentInItem,
} from '@/lib/segmentManager';
import { calculateSegmentsClient } from '@/lib/calculateSegmentsClient';

interface CalendarCollectionsManagerProps {
  collections: any[];
  defaultDuration?: number;
  startHour?: number;
  endHour?: number;
  showCollectionsSelector?: boolean;
  onViewDetail?: (item: any) => void;
  onEdit?: (item: any) => void;
  onDelete?: (id: string) => void;
  hiddenFields?: string[];
  onEditField?: (updatedItem: any) => void;
  onRelationChange?: (property: any, item: any, value: any) => void;
  onShowNewItemModalForCollection?: (collection: any, item?: any) => void;
  selectedCollectionIds: string[];
  onToggleCollection: (collectionId: string, enabled: boolean) => void;
  dateFields: Record<string, string>;
  onChangeDateField: (collectionId: string, fieldId: string) => void;
  collectionRoles?: Record<string, 'primary' | 'secondary' | 'default'>;
  onChangeCollectionRole?: (collectionId: string, role: 'primary' | 'secondary' | 'default') => void;
  viewModeStorageKey?: string;
}

const CalendarCollectionsManager: React.FC<CalendarCollectionsManagerProps> = ({
  collections,
  defaultDuration = 1,
  startHour = 8,
  endHour = 20,
  showCollectionsSelector = true,
  hiddenFields,
  onViewDetail = () => {},
  onEdit = () => {},
  onDelete = () => {},
  onRelationChange,
  onShowNewItemModalForCollection,
  selectedCollectionIds,
  onToggleCollection,
  dateFields,
  onChangeDateField,
  collectionRoles = {},
  onChangeCollectionRole,
  viewModeStorageKey,
}) => {
  const [moveMode, setMoveMode] = useState<'all' | 'segment' | 'segment-following'>('segment');
  // Fonction pour gérer le déplacement d'un événement (drag & drop)
  /**
   * Déplace uniquement le segment concerné (par défaut), ou tous les segments si moveAllSegments=true
   * @param item L'item à modifier
   * @param newDate Nouvelle date (jour)
   * @param newHours Nouvelle heure
   * @param newMinutes Nouvelles minutes
   * @param options { moveAllSegments?: boolean, segmentIndex?: number }

  
   */
  const onEventDrop = (item: any, newDate: Date, newHours: number, newMinutes: number, options?: { moveAllSegments?: boolean, moveMode?: 'all' | 'segment' | 'segment-following', segmentIndex?: number, visibleSegments?: Array<{ itemId: string; segmentIndex: number; start: string }> }) => {
    const fallbackMode = options?.moveAllSegments !== undefined
      ? (options.moveAllSegments ? 'all' : 'segment')
      : moveMode;
    const resolvedMoveMode = options?.moveMode || fallbackMode;
    console.log('[onEventDrop] Appel avec options:', options, 'moveMode:', resolvedMoveMode);
    const col = collections.find((c) => c.id === item.__collectionId);
    if (!col) {
      console.warn('[onEventDrop] Collection non trouvée pour', item);
      return;
    }
    const dateFieldId = dateFields[col.id];
    const dateField = col.properties.find((p: any) => p.id === dateFieldId);
    if (!dateField) {
      console.warn('[onEventDrop] Champ date non trouvé pour', item);
      return;
    }
    
    // NOUVEAU COMPORTEMENT: Tous les modifications passent par le segmentManager
    // qui met en place l'item pour la sauvegarde en BDD
    // Le serveur recalculera les segments si on modifie un champ date
    
    if (resolvedMoveMode === 'all') {
      // Déplace tout : modifie le champ date principal
      // Le serveur recalculera les segments automatiquement
      const updatedItem = moveAllSegmentsOfItem(item, dateField.id, newDate, newHours, newMinutes, col);
      onEdit(updatedItem);
    } else if (resolvedMoveMode === 'segment-following' && typeof options?.segmentIndex === 'number') {
      const segments = Array.isArray(item._eventSegments) ? item._eventSegments : [];
      const movedSeg = segments[options.segmentIndex];
      if (!movedSeg) return;
      const oldStart = new Date(movedSeg.start || movedSeg.__eventStart);
      const newStart = new Date(newDate);
      newStart.setHours(newHours ?? 9, newMinutes ?? 0, 0, 0);
      const deltaMs = newStart.getTime() - oldStart.getTime();
      if (!Number.isFinite(deltaMs)) return;

      const visibleSegments = Array.isArray(options?.visibleSegments) ? options.visibleSegments : [];
      const activeKey = `${item.id}:${options.segmentIndex}`;
      const activePos = visibleSegments.findIndex(
        (seg) => `${seg.itemId}:${seg.segmentIndex}` === activeKey
      );
      if (activePos === -1) return;

      const updatedIds = new Set<string>();
      visibleSegments.slice(activePos).forEach((segRef) => {
        if (updatedIds.has(segRef.itemId)) return;
        const targetItem = (col.items || []).find((it: any) => it.id === segRef.itemId);
        if (!targetItem) return;
        const segStart = new Date(segRef.start);
        const nextStart = new Date(segStart.getTime() + deltaMs);
        const updatedItem = {
          ...targetItem,
          __collectionId: targetItem.__collectionId || col.id,
          [dateField.id]: nextStart.toISOString(),
          _preserveEventSegments: false,
        };
        const recalculatedSegments = calculateSegmentsClient(updatedItem, col);
        onEdit({ ...updatedItem, _eventSegments: recalculatedSegments });
        updatedIds.add(segRef.itemId);
      });
    } else if (typeof options?.segmentIndex === 'number' && Array.isArray(item._eventSegments)) {
      // Déplacement d'un seul segment : on ne modifie que ce segment dans _eventSegments
      const duration = new Date(item._eventSegments[options.segmentIndex].end).getTime() - 
                       new Date(item._eventSegments[options.segmentIndex].start).getTime();
      
      const segStart = new Date(newDate);
      segStart.setHours(newHours ?? 9, newMinutes ?? 0, 0, 0);
      const segEnd = new Date(segStart.getTime() + duration);
      
      const updatedItem = updateSegmentInItem(item, options.segmentIndex, {
        start: segStart.toISOString(),
        end: segEnd.toISOString()
      });
      onEdit(updatedItem);
    } else {
      // Fallback : déplace tout
      const updatedItem = moveAllSegmentsOfItem(item, dateField.id, newDate, newHours, newMinutes, col);
      onEdit(updatedItem);
    }
  };
  // --- State pour la vue et la date courante ---
  const MONTH_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const getMonday = (date: string | number | Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };
  const getPreviousPeriod = (date: string | number | Date, mode: string) => {
    const d = new Date(date);
    if (mode === 'month') d.setMonth(d.getMonth() - 1);
    else if (mode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    return d;
  };
  const getNextPeriod = (date: string | number | Date, mode: string) => {
    const d = new Date(date);
    if (mode === 'month') d.setMonth(d.getMonth() + 1);
    else if (mode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    return d;
  };
  const getInitialViewMode = () => {
    if (typeof window !== 'undefined') {
      try {
        const key = viewModeStorageKey ? `calendarViewMode:${viewModeStorageKey}` : 'calendarViewMode';
        const saved = window.localStorage.getItem(key);
        if (saved === 'month' || saved === 'week' || saved === 'day') return saved;
      } catch {}
    }
    return 'month';
  };
  const [viewMode, setViewMode] = useState(getInitialViewMode());
  const [currentDate, setCurrentDate] = useState(new Date());
  const setViewModePersist = (mode: React.SetStateAction<string>) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      try {
        const modeValue = typeof mode === 'function' ? mode(viewMode) : mode;
        const key = viewModeStorageKey ? `calendarViewMode:${viewModeStorageKey}` : 'calendarViewMode';
        window.localStorage.setItem(key, modeValue);
      } catch {}
    }
  };

  const collectionsWithDate = collections.filter((collection) =>
    collection.properties?.some(
      (p: any) => p.type === 'date' || p.type === 'date_range'
    )
  );
  const activeCollections = collectionsWithDate.filter((col) =>
    selectedCollectionIds.includes(col.id)
  );

  // Filtrage des items par collection
  const getFilteredItems = (collection: any) => {
    const dateFieldId = dateFields[collection.id];
    const dateField = collection.properties.find((p: any) => p.id === dateFieldId);
    let items = collection.items || [];
    // NE GARDER QUE les items qui ont une valeur dans le champ date sélectionné
    items = items.filter((item: any) => {
      if (!dateField || !dateFieldId) return false;
      if (!item[dateFieldId]) return false;
      return true;
    });
    // Ajoute la référence collection à chaque item
    return items.map((item: any) => ({ ...item, __collectionId: collection.id }));
  };

  // Rendu header + panneaux de filtre + vue calendrier
  return (
    <div>
      <div className="sticky md:relative top-0 z-10 mb-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between md:flex-wrap lg:pl-[50px]">
          <h2 className="text-2xl font-bold text-white">
          {viewMode === 'month'
            ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
            : viewMode === 'week'
            ? `Semaine du ${getMonday(currentDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
            : currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          }
          </h2>
          <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center md:flex-wrap">
            {showCollectionsSelector && (
              <details className="relative w-full sm:w-auto">
                <summary className="list-none cursor-pointer select-none px-3 py-2 rounded-lg text-sm font-medium bg-black/10 dark:bg-white/5 text-neutral-700  dark:text-neutral-300 hover:bg-white/10 transition-all">
                  Collections affichées
                </summary>
                <div className="absolute left-0 mt-2 w-[min(90vw,520px)] max-h-[60vh] overflow-auto rounded-xl border border-white/10 bg-neutral-950/95 p-4 shadow-xl backdrop-blur z-20">
                  <div className="space-y-4">
                    {collectionsWithDate.map((collection) => {
                      const dateOptions = collection.properties.filter(
                        (p: any) => p.type === 'date' || p.type === 'date_range'
                      );
                      const isSelected = selectedCollectionIds.includes(collection.id);
                      return (
                        <div key={collection.id} className="space-y-2">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => onToggleCollection(collection.id, e.target.checked)}
                              className="accent-violet-500"
                            />
                            <span>{collection.name}</span>
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-neutral-400">Temps</span>
                            <select
                              className="bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-sm"
                              value={dateFields[collection.id] || ''}
                              onChange={(e) => onChangeDateField(collection.id, e.target.value)}
                              disabled={!isSelected || dateOptions.length === 0}
                            >
                              <option value="" disabled>
                                {dateOptions.length === 0 ? 'Aucun champ date' : 'Choisir'}
                              </option>
                              {dateOptions.map((p: any) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <select
                              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm"
                              value={collectionRoles[collection.id] || 'default'}
                              onChange={(e) => onChangeCollectionRole?.(collection.id, e.target.value as 'primary' | 'secondary' | 'default')}
                              disabled={!isSelected}
                            >
                              <option value="default">Autre</option>
                              <option value="primary">Principale</option>
                              <option value="secondary">Secondaire</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
            )}
            <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto md:flex-col lg:flex-row">
              <div className="inline-flex rounded-full bg-white/5 p-1 border border-white/10 sm:w-auto">
                {([
                  { key: 'month', label: 'Mois' },
                  { key: 'week', label: 'Semaine' },
                  { key: 'day', label: 'Jour' },
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setViewModePersist(option.key)}
                    className={
                      'px-3 py-1 text-xs rounded-full transition-all ' +
                      (viewMode === option.key
                        ? 'bg-violet-500/30 text-violet-100 border border-violet-400/40 shadow-sm'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5')
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
          {/* Option de déplacement visible seulement en vue calendrier (week ou day) */}
          {(viewMode === 'week' || viewMode === 'day') && (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-lg px-4 py-3 sm:w-auto sm:ml-2">
              <span className="text-xs text-neutral-400">Déplacement :</span>
              <div className="inline-flex rounded-full bg-white/5 p-1 border border-white/10">
                {([
                  { key: 'segment', label: 'Seul' },
                  { key: 'all', label: 'Complet' },
                  { key: 'segment-following', label: ' + suivants' },
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setMoveMode(option.key)}
                    className={
                      'px-3 py-1 text-xs rounded-full transition-all ' +
                      (moveMode === option.key
                        ? 'bg-violet-500/30 text-violet-100 border border-violet-400/40 shadow-sm'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5')
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex">
            <button onClick={() => setCurrentDate(getPreviousPeriod(currentDate, viewMode))} className="rounded-lg p-2 transition-colors hover:bg-white/10">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 text-sm font-medium bg-violet-500 dark:bg-violet-500/20 hover:bg-violet-700 dark:hover:bg-violet-500/30 text-violet-200 rounded-lg transition-colors border border-violet-500/30"
            >
              Aujourd'hui
            </button>
            <button onClick={() => setCurrentDate(getNextPeriod(currentDate, viewMode))} className="rounded-lg p-2 transition-colors hover:bg-white/10">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
            </button>
            </div>
            </div>
          </div>
        </div>
      </div>
      {/* Affichage de la vue calendrier selon viewMode */}
      {viewMode === 'month' ? (
        <MonthView
          currentDate={currentDate}
          items={activeCollections.flatMap(getFilteredItems)}
          dateField={undefined}
          collection={undefined}
          onDateSelect={() => {}}
          onViewDetail={onViewDetail}
          onDelete={onDelete}
          getNameValue={(item) => {
            const col = collections.find(c => c.id === item.__collectionId);
            if (!col) return item.name || 'Sans titre';
            const nameField = col.properties.find((p: any) => p.name === 'Nom' || p.id === 'name');
            return nameField ? item[nameField.id] : item.name || 'Sans titre';
          }}
          getItemsForDate={() => []}
        />
      ) : viewMode === 'week' ? (
        (() => {
          return (
            <WeekView
              currentDate={currentDate}
              items={activeCollections.flatMap(getFilteredItems)}
              collections={activeCollections}
              collectionsAll={collections}
              collectionRoles={collectionRoles}
              getNameValue={(item) => {
                const col = collections.find(c => c.id === item.__collectionId);
                if (!col) return item.name || 'Sans titre';
                const nameField = col.properties.find((p: any) => p.name === 'Nom' || p.id === 'name');
                return nameField ? item[nameField.id] : item.name || 'Sans titre';
              }}
              getItemsForDate={() => []}
              getDateFieldForItem={(item) => {
                const col = collections.find(c => c.id === item.__collectionId);
                if (!col) return undefined;
                const dateFieldId = dateFields[col.id];
                return col.properties.find((p: any) => p.id === dateFieldId);
              }}
              hiddenFields={hiddenFields}
              onEditField={onEdit}
              onRelationChange={onRelationChange}
              onDelete={onDelete}
              onEdit={onEdit}
              onViewDetail={onViewDetail}
              defaultDuration={defaultDuration}
              startHour={startHour}
              endHour={endHour}
              onShowNewItemModalForCollection={onShowNewItemModalForCollection}
              onEventDrop={onEventDrop}
            />
          );
        })()
      ) : (
        <WeekView
          currentDate={currentDate}
          items={activeCollections.flatMap(getFilteredItems)}
          collections={activeCollections}
          collectionsAll={collections}
          collectionRoles={collectionRoles}
          getNameValue={(item) => {
            const col = collections.find(c => c.id === item.__collectionId);
            if (!col) return item.name || 'Sans titre';
            const nameField = col.properties.find((p: any) => p.name === 'Nom' || p.id === 'name');
            return nameField ? item[nameField.id] : item.name || 'Sans titre';
          }}
          getItemsForDate={() => []}
          getDateFieldForItem={(item: { __collectionId: any; }) => {
            const col = collections.find(c => c.id === item.__collectionId);
            if (!col) return undefined;
            const dateFieldId = dateFields[col.id];
            return col.properties.find((p: any) => p.id === dateFieldId);
          }}
          hiddenFields={hiddenFields}
          onEditField={onEdit}
          onRelationChange={onRelationChange}
          onDelete={onDelete}
          onEdit={onEdit}
          onViewDetail={onViewDetail}
          defaultDuration={defaultDuration}
          startHour={startHour}
          endHour={endHour}
          onShowNewItemModalForCollection={onShowNewItemModalForCollection}
          onEventDrop={onEventDrop}
          singleDay
        />
      )}
    </div>
  );
};

export default CalendarCollectionsManager;
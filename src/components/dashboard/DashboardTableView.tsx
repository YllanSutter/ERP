import React, { useCallback, useMemo, useState } from 'react';
import TableView from '@/components/views/TableView';
import TableHeader from '@/components/TableView/TableHeader';
import TableItemRow from '@/components/TableView/TableItemRow';
import { useCanEdit, useCanEditField, useCanViewField } from '@/lib/hooks/useCanEdit';

interface DashboardTableSection {
  key: string;
  title: string;
  collection: any;
  items: any[];
  orderedProperties: any[];
  dateFieldLabel?: string;
  monthBuckets?: Array<{ monthIndex: number; label: string; items: any[] }>;
}

interface DashboardTableViewProps {
  sections: DashboardTableSection[];
  collections: any[];
  hiddenBySection: Record<string, string[]>;
  onChangeHiddenBySection: (next: Record<string, string[]>) => void;
  onEdit?: (item: any) => void;
  onDelete: (id: string) => void;
  onViewDetail: (item: any) => void;
}

const formatDurationHeureMinute = (duree: number) => {
  if (typeof duree !== 'number' || Number.isNaN(duree)) return '';
  const heures = Math.floor(duree);
  const minutes = Math.round((duree - heures) * 60);
  return `${heures}h${minutes.toString().padStart(2, '0')}`;
};

const getItemDurationHours = (item: any) => {
  const segments = Array.isArray(item?._eventSegments) ? item._eventSegments : [];
  if (!segments.length) return 0;
  return segments.reduce((acc: number, seg: any) => {
    if (!seg?.start || !seg?.end) return acc;
    const start = new Date(seg.start);
    const end = new Date(seg.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return acc;
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return acc + Math.max(0, hours);
  }, 0);
};

const DashboardTableView: React.FC<DashboardTableViewProps> = ({
  sections,
  collections,
  hiddenBySection,
  onChangeHiddenBySection,
  onEdit,
  onDelete,
  onViewDetail,
}) => {
  const groupedByCollection = useMemo(() => {
    const map = new Map<string, DashboardTableSection[]>();
    sections.forEach((section) => {
      const collectionId = section.collection?.id || 'unknown';
      if (!map.has(collectionId)) map.set(collectionId, []);
      map.get(collectionId)!.push(section);
    });
    return Array.from(map.entries()).map(([collectionId, items]) => ({
      collectionId,
      collectionName: items[0]?.collection?.name || 'Collection',
      sections: items,
    }));
  }, [sections]);

  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    groupedByCollection[0]?.collectionId || null
  );

  const activeSections = useMemo(() => {
    if (!activeCollectionId) return sections;
    return groupedByCollection.find((g) => g.collectionId === activeCollectionId)?.sections || sections;
  }, [activeCollectionId, groupedByCollection, sections]);

  const toggleHiddenField = useCallback((sectionKey: string, fieldId: string) => {
    const current = hiddenBySection?.[sectionKey] || [];
    const next = current.includes(fieldId)
      ? current.filter((id) => id !== fieldId)
      : [...current, fieldId];
    onChangeHiddenBySection({
      ...(hiddenBySection || {}),
      [sectionKey]: next,
    });
  }, [hiddenBySection, onChangeHiddenBySection]);

  if (!sections.length) {
    return (
      <div className="text-sm text-neutral-500">
        Aucune collection avec un champ date et des éléments ce mois.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedByCollection.length > 1 && (
        <div className="inline-flex rounded-full bg-white/60 dark:bg-white/5 p-1 border border-black/10 dark:border-white/10">
          {groupedByCollection.map((group) => (
            <button
              key={group.collectionId}
              type="button"
              onClick={() => setActiveCollectionId(group.collectionId)}
              className={
                'px-3 py-1 text-xs rounded-full transition-all ' +
                (activeCollectionId === group.collectionId
                  ? 'bg-violet-500/30 text-violet-700 dark:text-violet-100 border border-violet-400/40 shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5')
              }
            >
              {group.collectionName}
            </button>
          ))}
        </div>
      )}
      {activeSections.map((section) => (
        <div key={section.key} className="space-y-2">
          <div className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
            {section.title}
            {section.dateFieldLabel && (
              <span className="ml-2 text-xs text-neutral-400">· filtré sur {section.dateFieldLabel}</span>
            )}
          </div>
          {(hiddenBySection?.[section.key] || []).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
              <span className="text-neutral-400">Colonnes masquées :</span>
              {(hiddenBySection?.[section.key] || []).map((fieldId) => {
                const label = section.orderedProperties.find((p: any) => p.id === fieldId)?.name || fieldId;
                return (
                  <button
                    key={fieldId}
                    type="button"
                    onClick={() => toggleHiddenField(section.key, fieldId)}
                    className="px-2 py-0.5 rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {label} · afficher
                  </button>
                );
              })}
            </div>
          )}
          <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-neutral-900/50 shadow-sm">
            {section.monthBuckets ? (
              <DashboardMonthlyTable
                section={section}
                collections={collections}
                hiddenFields={hiddenBySection?.[section.key] || []}
                onToggleField={(fieldId) => toggleHiddenField(section.key, fieldId)}
                onEdit={onEdit}
                onDelete={onDelete}
                onViewDetail={onViewDetail}
              />
            ) : (
              <>
                <TableView
                  collection={section.collection}
                  items={section.items}
                  onEdit={(item: any) => onEdit?.({ ...item, __collectionId: section.collection.id })}
                  onDelete={onDelete}
                  onViewDetail={(item: any) => onViewDetail({ ...item, _collection: section.collection })}
                  hiddenFields={hiddenBySection?.[section.key] || []}
                  orderedProperties={section.orderedProperties}
                  onReorderItems={() => {}}
                  onToggleField={(fieldId: string) => toggleHiddenField(section.key, fieldId)}
                  onDeleteProperty={() => {}}
                  onEditProperty={() => {}}
                  collections={collections}
                  onRelationChange={(prop: any, item: any, val: any) => {
                    const updatedItem = { ...item, [prop.id]: val, __collectionId: section.collection.id };
                    onEdit?.(updatedItem);
                  }}
                  onNavigateToCollection={() => {}}
                  groups={[]}
                />
                <div className="px-3 py-2 text-xs text-right text-neutral-600 dark:text-neutral-300 border-t border-black/5 dark:border-white/10">
                  {(() => {
                    const collectionName = section.collection?.name || 'Collection';
                    const totalDuration = section.items.reduce(
                      (acc, item) => acc + getItemDurationHours(item),
                      0
                    );
                    return `Total · ${section.items.length} ${collectionName} · ${formatDurationHeureMinute(totalDuration)}`;
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const DashboardMonthlyTable: React.FC<{
  section: DashboardTableSection;
  collections: any[];
  hiddenFields: string[];
  onToggleField: (fieldId: string) => void;
  onEdit?: (item: any) => void;
  onDelete: (id: string) => void;
  onViewDetail: (item: any) => void;
}> = ({
  section,
  collections,
  hiddenFields,
  onToggleField,
  onEdit,
  onDelete,
  onViewDetail,
}) => {
  const [sortState, setSortState] = useState<{ column: string | null; direction: 'asc' | 'desc' }>(
    { column: null, direction: 'asc' }
  );
  const canEdit = useCanEdit(section.collection?.id);
  const canEditFieldFn = (fieldId: string) => useCanEditField(fieldId, section.collection?.id);
  const canViewFieldFn = (fieldId: string) => useCanViewField(fieldId, section.collection?.id);

  const visibleProperties = useMemo(
    () => section.orderedProperties.filter((p: any) => !hiddenFields.includes(p.id) && canViewFieldFn(p.id)),
    [section.orderedProperties, hiddenFields, canViewFieldFn]
  );

  const sortItems = useCallback((arr: any[]) => {
    if (!sortState.column) return arr;
    const col = sortState.column;
    return [...arr].sort((a, b) => {
      const aVal = a && col in a ? a[col] : undefined;
      const bVal = b && col in b ? b[col] : undefined;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortState.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortState.direction === 'asc'
        ? String(aVal).localeCompare(String(bVal), 'fr', { numeric: true })
        : String(bVal).localeCompare(String(aVal), 'fr', { numeric: true });
    });
  }, [sortState]);

  const handleSort = useCallback((columnId: string) => {
    setSortState((prev) => {
      if (prev.column === columnId) {
        return { column: columnId, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column: columnId, direction: 'asc' };
    });
  }, []);


  return (
    <div className="border border-black/10 dark:border-white/5 rounded-lg overflow-hidden backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full">
          <TableHeader
            visibleProperties={visibleProperties}
            items={section.items}
            onEditProperty={() => {}}
            onToggleField={onToggleField}
            onDeleteProperty={() => {}}
            collectionId={section.collection?.id}
            sortState={sortState}
            onSort={handleSort}
          />
          <tbody className="divide-y divide-white/5">
            {section.monthBuckets?.map((bucket) => (
              <React.Fragment key={`${section.key}-month-${bucket.monthIndex}`}>
                <tr className="bg-neutral-100/80 dark:bg-neutral-900/50">
                  <td
                    colSpan={Math.max(1, visibleProperties.length)}
                    className="px-3 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300"
                  >
                    {bucket.label}
                  </td>
                </tr>
                {sortItems(bucket.items).map((item) => (
                  <TableItemRow
                    key={item.id}
                    item={item}
                    visibleProperties={visibleProperties}
                    onEdit={(updated: any) => onEdit?.({ ...updated, __collectionId: section.collection.id })}
                    onDelete={onDelete}
                    onViewDetail={(it: any) => onViewDetail({ ...it, _collection: section.collection })}
                    collections={collections}
                    onRelationChange={(prop: any, it: any, val: any) => {
                      const updatedItem = { ...it, [prop.id]: val, __collectionId: section.collection.id };
                      onEdit?.(updatedItem);
                    }}
                    onNavigateToCollection={() => {}}
                    canEdit={canEdit}
                    canEditField={canEditFieldFn}
                    animate={false}
                    collection={section.collection}
                  />
                ))}
                <tr className="bg-white/70 dark:bg-white/5">
                  <td
                    colSpan={Math.max(1, visibleProperties.length)}
                    className="px-3 py-2 text-xs text-right text-neutral-600 dark:text-neutral-300"
                  >
                    {(() => {
                      const collectionName = section.collection?.name || 'Collection';
                      const totalDuration = bucket.items.reduce(
                        (acc, item) => acc + getItemDurationHours(item),
                        0
                      );
                      return `Total ${bucket.label} · ${bucket.items.length} ${collectionName} · ${formatDurationHeureMinute(totalDuration)}`;
                    })()}
                  </td>
                </tr>
              </React.Fragment>
            ))}
            <tr className="bg-neutral-100/70 dark:bg-neutral-900/40">
              <td
                colSpan={Math.max(1, visibleProperties.length)}
                className="px-3 py-2 text-xs text-right text-neutral-700 dark:text-neutral-200"
              >
                {(() => {
                  const collectionName = section.collection?.name || 'Collection';
                  const totalDuration = section.items.reduce(
                    (acc, item) => acc + getItemDurationHours(item),
                    0
                  );
                  return `Total annuel · ${section.items.length} ${collectionName} · ${formatDurationHeureMinute(totalDuration)}`;
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardTableView;

import React, { useCallback } from 'react';
import TableView from '@/components/views/TableView';

interface DashboardTableSection {
  key: string;
  title: string;
  collection: any;
  items: any[];
  orderedProperties: any[];
  dateFieldLabel?: string;
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

const DashboardTableView: React.FC<DashboardTableViewProps> = ({
  sections,
  collections,
  hiddenBySection,
  onChangeHiddenBySection,
  onEdit,
  onDelete,
  onViewDetail,
}) => {
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
      {sections.map((section) => (
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
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardTableView;

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ui/ShinyButton';
import { cn } from '@/lib/utils';

interface NewViewModalProps {
  onClose: () => void;
  onSave: (name: any, type?: string, config?: any) => void;
  collection: any;
  view?: any;
  mode?: 'create' | 'edit';
  availableViews?: any[];
  collections?: any[];
  allViews?: Record<string, any[]>;
}

const NewViewModal: React.FC<NewViewModalProps> = ({
  onClose,
  onSave,
  collection,
  view,
  mode = 'create',
  availableViews = [],
  collections = [],
  allViews = {}
}) => {
  const [name, setName] = useState(view?.name || '');
  const [type, setType] = useState(view?.type || 'table');
  const [groupBy, setGroupBy] = useState(view?.groupBy || '');
  const [dateProperty, setDateProperty] = useState(view?.dateProperty || '');
  const [layoutPanels, setLayoutPanels] = useState<any[]>(() => Array.isArray(view?.layoutPanels) ? view.layoutPanels : []);
  
  const viewTypes = [
    { value: 'table', label: 'Tableau' },
    { value: 'kanban', label: 'Kanban' },
    { value: 'calendar', label: 'Calendrier' },
    { value: 'layout', label: 'Multi-vues' }
  ];

  const selectProps = collection?.properties.filter((p: any) => p.type === 'select') || [];
  const collectionOptions = collections.length ? collections : (collection ? [collection] : []);
  const dateProps = collection?.properties.filter((p: any) => p.type === 'date' || p.type === 'date_range') || [];

  const handleSave = () => {
    const props = collection?.properties || [];
    const defaultVisibleFieldIds = Array.isArray(collection?.defaultVisibleFieldIds)
      ? collection.defaultVisibleFieldIds
      : (props[0] ? [props[0].id] : []);
    const defaultHiddenFields = props.filter((p: any) => !defaultVisibleFieldIds.includes(p.id)).map((p: any) => p.id);
    const config: any = { name, type };
    if (mode === 'create') config.hiddenFields = defaultHiddenFields;
    if (type === 'kanban' && groupBy) config.groupBy = groupBy;
    if (type === 'calendar' && dateProperty) config.dateProperty = dateProperty;
    if (type === 'layout') config.layoutPanels = layoutPanels;
    if (mode === 'edit') {
      onSave({ ...config, name, type } as any);
      return;
    }
    onSave(name, type, config);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl p-8 min-w-96 max-h-[80vh] overflow-y-auto backdrop-blur" onClick={e => e.stopPropagation()} >
        <h3 className="text-xl font-bold mb-6">{mode === 'edit' ? 'Modifier la vue' : 'Nouvelle vue'}</h3>
        <div className="space-y-4">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la vue" className="w-full px-4 py-2 bg-gray-300 dark:bg-neutral-800/50 borderborder-black/10 dark:border-white/10  rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none" />
          <div className="space-y-2">
            {viewTypes.map(vt => (
              <button
                key={vt.value}
                onClick={() => setType(vt.value)}
                className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all', type === vt.value ? 'border-violet-500 bg-violet-500/20' : 'border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20')}
              >
                <span className="font-medium">{vt.label}</span>
              </button>
            ))}
          </div>

          {type === 'kanban' && selectProps.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Grouper par</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="w-full px-4 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none">
                <option value="">Sélectionner une propriété...</option>
                {selectProps.map((prop: any) => (
                  <option key={prop.id} value={prop.id}>{prop.name}</option>
                ))}
              </select>
            </div>
          )}

          {type === 'layout' && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Vues à combiner</div>
              {layoutPanels.map((panel, idx) => (
                <div key={panel.id || idx} className="flex items-center gap-2">
                  <select
                    value={panel.collectionId || collection?.id || ''}
                    onChange={(e) => {
                      const next = [...layoutPanels];
                      next[idx] = { ...next[idx], collectionId: e.target.value, viewId: '' };
                      setLayoutPanels(next);
                    }}
                    className="w-40 px-2 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white"
                  >
                    <option value="">Collection…</option>
                    {collectionOptions.map((col: any) => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                  <select
                    value={panel.viewId || ''}
                    onChange={(e) => {
                      const next = [...layoutPanels];
                      next[idx] = { ...next[idx], viewId: e.target.value };
                      setLayoutPanels(next);
                    }}
                    className="flex-1 px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white"
                  >
                    <option value="">Choisir une vue…</option>
                    {(allViews[panel.collectionId || collection?.id || ''] || availableViews)
                      .filter((v: any) => v.type !== 'layout')
                      .map((v: any) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                  </select>
                  <select
                    value={panel.colSpan || 6}
                    onChange={(e) => {
                      const next = [...layoutPanels];
                      next[idx] = { ...next[idx], colSpan: Number(e.target.value) };
                      setLayoutPanels(next);
                    }}
                    className="w-20 px-2 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white"
                  >
                    {[3,4,6,8,12].map((n) => (
                      <option key={n} value={n}>{n}/12</option>
                    ))}
                  </select>
                  <select
                    value={panel.rowSpan || 2}
                    onChange={(e) => {
                      const next = [...layoutPanels];
                      next[idx] = { ...next[idx], rowSpan: Number(e.target.value) };
                      setLayoutPanels(next);
                    }}
                    className="w-20 px-2 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white"
                  >
                    {[1,2,3,4].map((n) => (
                      <option key={n} value={n}>{n}L</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setLayoutPanels((prev) => prev.filter((_, i) => i !== idx))}
                    className="px-2 py-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLayoutPanels((prev) => ([...prev, { id: Date.now().toString(), collectionId: collection?.id || '', viewId: '', colSpan: 6, rowSpan: 2 }]))}
                className="px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-sm"
              >
                + Ajouter un panneau
              </button>
            </div>
          )}
         
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={handleSave} className="flex-1">{mode === 'edit' ? 'Enregistrer' : 'Créer'}</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default NewViewModal;

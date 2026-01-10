import React from 'react';
import ShinyButton from '@/components/ui/ShinyButton';

const DashboardColumnConfig = ({
  dashboard,
  collections,
  properties,
  leafColumns,
  typeValuesInput,
  setTypeValuesInput,
  handleAddLeaf,
  handleUpdateLeaf,
  handleRemoveLeaf,
  onUpdate,
}: any) => {
  return (
    <div className="border border-white/10 rounded-lg p-4 bg-neutral-900/60 mt-20">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Configuration</h3>
          <p className="text-sm text-neutral-500">Sélectionne les champs date, type et durée, puis mappe les colonnes.</p>
        </div>
        <ShinyButton onClick={handleAddLeaf} className="px-4 py-2">
          Ajouter une colonne
        </ShinyButton>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-neutral-400">Champ type</span>
          <select
            value={dashboard.typeField || ''}
            onChange={(e) => onUpdate && onUpdate({ typeField: e.target.value || null })}
            className="bg-neutral-900 border border-white/10 rounded px-3 py-2"
          >
            <option value="">À définir</option>
            {collections
              .find((c: any) => c.id === dashboard.sourceCollectionId)?.properties?.map((prop: any) => (
                <option key={prop.id} value={prop.id}>
                  {prop.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-neutral-400">Champ date (simple)</span>
          <select
            value={dashboard.globalDateField || ''}
            onChange={(e) => onUpdate && onUpdate({ globalDateField: e.target.value || null })}
            className="bg-neutral-900 border border-white/10 rounded px-3 py-2"
          >
            <option value="">Héritées</option>
            {collections
              .find((c: any) => c.id === dashboard.sourceCollectionId)?.properties?.map((prop: any) => (
                <option key={prop.id} value={prop.id}>
                  {prop.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 items-stretch">
        {leafColumns.length === 0 && (
          <div className="text-sm text-neutral-500">Ajoute une colonne pour mapper les valeurs du champ type.</div>
        )}
        {leafColumns.map((leaf: any) => {
          const typeValuesText = typeValuesInput[leaf.id] ?? (leaf.typeValues || []).join(', ');
          return (
            <div key={leaf.id} className="bg-neutral-900 border border-white/10 rounded px-3 py-2">
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={leaf.label}
                  onChange={(e) => handleUpdateLeaf(leaf.id, { label: e.target.value })}
                  className="flex-1 bg-neutral-900 border border-white/10 rounded px-3 py-2 text-sm"
                />
                <button
                  onClick={() => handleRemoveLeaf(leaf.id)}
                  className="text-red-300 hover:text-white hover:bg-red-500/20 rounded px-2 py-1 text-sm"
                >
                  Supprimer
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-neutral-400">Valeurs champ type (séparées par , )</span>
                  <input
                    value={typeValuesText}
                    onChange={(e) => {
                      setTypeValuesInput((prev: any) => ({ ...prev, [leaf.id]: e.target.value }));
                      const arr = e.target.value
                        .split(',')
                        .map((v: any) => v.trim())
                        .filter(Boolean);
                      handleUpdateLeaf(leaf.id, { typeValues: arr });
                    }}
                    className="bg-neutral-900 border border-white/10 rounded px-3 py-2"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-neutral-400">Date unique</span>
                  <select
                    value={leaf.dateFieldOverride?.single || ''}
                    onChange={(e) =>
                      handleUpdateLeaf(leaf.id, {
                        dateFieldOverride: { ...leaf.dateFieldOverride, single: e.target.value || undefined, start: undefined, end: undefined }
                      })
                    }
                    className="bg-neutral-900 border border-white/10 rounded px-3 py-2"
                  >
                    <option value="">Héritées</option>
                    {
                      properties.filter((prop: any) => prop.type === 'date')
                      .map((prop: any) => (
                      <option key={prop.id} value={prop.id}>
                        {prop.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-neutral-400">Date début</span>
                  <select
                    value={leaf.dateFieldOverride?.start || ''}
                    onChange={(e) =>
                      handleUpdateLeaf(leaf.id, {
                        dateFieldOverride: { ...leaf.dateFieldOverride, start: e.target.value || undefined, single: undefined }
                      })
                    }
                    className="bg-neutral-900 border border-white/10 rounded px-3 py-2"
                  >
                    <option value="">Héritées</option>
                    {
                      properties.filter((prop: any) => prop.type === 'date')
                      .map((prop: any) => (
                      <option key={prop.id} value={prop.id}>
                        {prop.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-neutral-400">Date fin</span>
                  <select
                    value={leaf.dateFieldOverride?.end || ''}
                    onChange={(e) =>
                      handleUpdateLeaf(leaf.id, {
                        dateFieldOverride: { ...leaf.dateFieldOverride, end: e.target.value || undefined, single: undefined }
                      })
                    }
                    className="bg-neutral-900 border border-white/10 rounded px-3 py-2"
                  >
                     <option value="">Héritées</option>
                    {
                      properties.filter((prop: any) => prop.type === 'date')
                      .map((prop: any) => (
                      <option key={prop.id} value={prop.id}>
                        {prop.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardColumnConfig;
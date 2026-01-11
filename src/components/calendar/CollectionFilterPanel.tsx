import React from 'react';

interface CollectionFilterPanelProps {
  collection: any;
  filters: any;
  setFilters: (filters: any) => void;
  dateField?: string;
  setDateField: (fieldId: string) => void;
}

const CollectionFilterPanel: React.FC<CollectionFilterPanelProps> = ({
  collection,
  filters,
  setFilters,
  dateField,
  setDateField,
}) => {
  // Liste des champs date
  const dateFields = collection.properties.filter((p: any) => p.type === 'date' || p.type === 'date_range');

  // Liste des champs filtrables (hors champ date)
  const filterableFields = collection.properties.filter((p: any) => p.type !== 'date' && p.type !== 'date_range');

  // Gestion locale des filtres
  const handleFilterChange = (fieldId: string, value: any) => {
    setFilters({ ...filters, [fieldId]: value });
  };

  return (
    <div className="mb-4 p-4 border border-white/10 rounded">
      <h3 className="font-bold mb-2">{collection.name}</h3>
      <div className="mb-2">
        <label>Champ date de référence&nbsp;:</label>
        <select className="border border-white/10 rounded px-2 py-1 bg-neutral-900 text-white" value={dateField || ''} onChange={e => setDateField(e.target.value)}>
          <option value="">-- Choisir --</option>
          {dateFields.map((field: any) => (
            <option key={field.id} value={field.id}>{field.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-4">
        {filterableFields.map((field: any) => (
          <div key={field.id} className="flex flex-col mb-2">
            <label className="text-sm font-medium mb-1">{field.name}</label>
            {field.type === 'select' && Array.isArray(field.options) ? (
              <select
                value={filters[field.id] || ''}
                onChange={e => handleFilterChange(field.id, e.target.value)}
                className="border border-white/10 rounded px-2 py-1 bg-neutral-900 text-white"
              >
                <option value="">-- Tous --</option>
                {field.options.map((opt: any, idx: number) => (
                  <option key={idx} value={typeof opt === 'string' ? opt : opt.value}>{typeof opt === 'string' ? opt : (opt.label || opt.value)}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={filters[field.id] || ''}
                onChange={e => handleFilterChange(field.id, e.target.value)}
                className="border border-white/10 rounded px-2 py-1 bg-neutral-900 text-white"
                placeholder={`Filtrer par ${field.name}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CollectionFilterPanel;

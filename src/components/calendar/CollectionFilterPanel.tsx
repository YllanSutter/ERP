
import React, { useEffect } from 'react';
import { LightMultiSelect } from '../inputs/LightMultiSelect';

interface FilterModalProps {
  properties: any[];
  collection: any;
  filters: any;
  setFilters: (filters: any) => void;
  dateField?: string;
  setDateField: (fieldId: string) => void;
  collections?: any[]; // Ajout de la prop collections
}

const CollectionFilterPanel: React.FC<FilterModalProps> = ({
  collection,
  filters,
  setFilters,
  dateField,
  setDateField,
  collections = [],
}) => {
  // Liste des champs date
  const dateFields = collection.properties.filter((p: any) => p.type === 'date' || p.type === 'date_range');

  // Liste des champs filtrables (hors champ date)
  const filterableFields = collection.properties.filter((p: any) => p.type !== 'date' && p.type !== 'date_range');

  // Gestion locale des filtres
  const handleFilterChange = (fieldId: string, value: any) => {
    setFilters({ ...filters, [fieldId]: value });
  };

const FILTERS_KEY = 'erp_collection_filters';
const DATEFIELD_KEY = 'erp_collection_datefield';


  // Charger les filtres et la dateField depuis localStorage au montage
  useEffect(() => {
    const savedFilters = localStorage.getItem(FILTERS_KEY);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          setFilters(parsed);
        }
      } catch {}
    }
    const savedDateField = localStorage.getItem(DATEFIELD_KEY);
    if (savedDateField && savedDateField !== '' && setDateField) {
      setDateField(savedDateField);
    }
    // eslint-disable-next-line
  }, []);

  // Sauvegarder les filtres à chaque modification (sauf si vide)
  useEffect(() => {
    if (filters && Object.keys(filters).length > 0) {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    }
  }, [filters]);

  // Sauvegarder la dateField à chaque modification
  useEffect(() => {
    if (dateField !== undefined && dateField !== null) {
      localStorage.setItem(DATEFIELD_KEY, dateField);
    }
  }, [dateField]);


  return (
    <div className="flex gap-8 items-center">
      <div className="flex gap-2 items-center flex-wrap">
        <label>Champ date de référence&nbsp;:</label>
        <select className="border border-white/10 rounded px-2 py-1 bg-neutral-900 text-white" value={dateField || ''} onChange={e => setDateField(e.target.value)}>
          <option value="">-- Choisir --</option>
          {dateFields.map((field: any) => (
            <option key={field.id} value={field.id}>{field.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-4">
        {filterableFields.map((field: any) => {
          // Champ relation : select (multiple ou simple)
          if (field.type === 'relation' && field.relation?.targetCollectionId) {
            const relation = field.relation || {};
            const targetCollectionId = relation.targetCollectionId;
            const relationType = relation.type || 'many_to_many';
            const targetCollection = collections.find((c: any) => c.id === targetCollectionId);
            const targetItems = targetCollection?.items || [];
            const isSourceMany = relationType === 'one_to_many' || relationType === 'many_to_many';
            const nameField = targetCollection?.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');
            const value = filters[field.id] || (isSourceMany ? [] : '');
            if (isSourceMany) {
              const currentValues = Array.isArray(value) ? value : [];
              return (
                <div key={field.id} className="flex gap-2 items-center">
                  <label className="text-sm font-medium">{field.name}</label>
                  <LightMultiSelect
                    options={targetItems.map((ti: any) => ({
                      value: ti.id,
                      label: nameField ? ti[nameField.id] || 'Sans titre' : ti.name || 'Sans titre'
                    }))}
                    values={currentValues}
                    onChange={(vals) => handleFilterChange(field.id, vals)}
                    placeholder="Aucun"
                    // Affiche le label (nom) dans les tags
                    getOptionLabel={opt => typeof opt === 'string' ? opt : (opt.label || opt.value)}
                  />
                </div>
              );
            } else {
              return (
                <div key={field.id} className="flex gap-2 items-center">
                  <label className="text-sm font-medium mb-1">{field.name}</label>
                  <select
                    value={typeof value === 'string' ? value : ''}
                    onChange={e => handleFilterChange(field.id, e.target.value)}
                    className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Sélectionner...</option>
                    {targetItems.map((ti: any) => {
                      const label = nameField ? ti[nameField.id] || 'Sans titre' : ti.name || 'Sans titre';
                      return <option key={ti.id} value={ti.id}>{label}</option>;
                    })}
                  </select>
                </div>
              );
            }
          }
          // Champ select classique
          if (field.type === 'select' && Array.isArray(field.options)) {
            return (
              <div key={field.id} className="flex gap-2 items-center">
                <label className="text-sm font-medium">{field.name}</label>
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
              </div>
            );
          }
          // Champ texte par défaut
          return (
            <div key={field.id} className="flex gap-2 items-center">
              <label className="text-sm font-medium">{field.name}</label>
              <input
                type="text"
                value={filters[field.id] || ''}
                onChange={e => handleFilterChange(field.id, e.target.value)}
                className="border border-white/10 rounded px-2 py-1 bg-neutral-900 text-white"
                placeholder={`Filtrer par ${field.name}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CollectionFilterPanel;

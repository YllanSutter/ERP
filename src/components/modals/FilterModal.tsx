import React, { useState } from 'react';
import type { CollectionFilter } from '@/lib/types';
import FilterCollectionFields from '@/components/filters/FilterCollectionFields';
import { Globe } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import ModalWrapper, { FormSelect } from '@/components/ui/ModalWrapper';
import FilterValueDisplay from '@/components/filters/FilterValueDisplay';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FILTER_OPERATORS, prepareFilterValue, getOrderedProperties,
} from '@/components/modals/modalLib';

interface FilterModalProps {
  embedded?: boolean;
  allowCollectionScope?: boolean;
  globalFilter?: boolean;
  scopeCollectionName?: string;
  properties: any[];
  collections: any[];
  onClose: () => void;
  onAdd: (property: string, operator: string, value: any, sourceCollectionId?: string, filterMeta?: any, collectionScope?: boolean) => void;
  initialFilter?: CollectionFilter | null;
}

const FilterModal: React.FC<FilterModalProps> = ({ embedded, properties, collections, onClose, onAdd, initialFilter, allowCollectionScope, globalFilter, scopeCollectionName }) => {
  const initialSource = collections.findIndex((collection) => collection.id === initialFilter?.sourceCollectionId);
  const defaultTabCandidate = collections.findIndex((collection) => collection.properties === properties);
  const [selectedTab, setSelectedTab] = useState(initialSource >= 0 ? initialSource : Math.max(0, defaultTabCandidate));
  const [property, setProperty] = useState(initialFilter?.property ?? '');
  const [operator, setOperator] = useState(initialFilter?.operator ?? 'equals');
  const [value, setValue] = useState<any>(initialFilter?.value ?? '');
  const [collectionScope, setCollectionScope] = useState(false);
  const [collectionFields, setCollectionFields] = useState<Record<string, string[]>>(initialFilter?.collectionFields ?? {});
  const useCollectionFields = globalFilter || collectionScope || Boolean(initialFilter?.collectionFields);
  const selectedCollection = collections[selectedTab] || null;

  const currentProperties = React.useMemo(() => {
    if (!selectedCollection) return [];
    return getOrderedProperties(selectedCollection, null, collections).filter((p: any) => !!p?.id);
  }, [selectedCollection, collections]);

  const isEditing = Boolean(initialFilter);
  const selectedProp = currentProperties.find((p: any) => p.id === property);

  const nativeProperties = React.useMemo(
    () => currentProperties.filter((p: any) => !p?.isRelationLinkedColumn),
    [currentProperties]
  );
  const linkedPropertiesByRelation = React.useMemo(() => {
    const groups = new Map<string, any[]>();
    currentProperties
      .filter((p: any) => p?.isRelationLinkedColumn && p?.sourceRelationPropertyId)
      .forEach((p: any) => {
        const key = p.sourceRelationPropertyId;
        groups.set(key, [...(groups.get(key) || []), p]);
      });
    return groups;
  }, [currentProperties]);

  const mappedFields = useCollectionFields && selectedCollection && property
    ? { ...collectionFields, [selectedCollection.id]: [...new Set([property, ...(collectionFields[selectedCollection.id] ?? [])])] }
    : undefined;
  const changeProperty = (id: string) => {
    if (selectedCollection) {
      setCollectionFields((fields) => ({
        ...fields,
        [selectedCollection.id]: (fields[selectedCollection.id] ?? []).filter((field) => field !== property),
      }));
    }
    setProperty(id);
  };

  const handleSave = () => {
    if (!property) return;
    onAdd(
      property,
      operator,
      prepareFilterValue(value, operator),
      selectedCollection?.id,
      selectedProp
        ? {
            isRelationLinkedColumn: Boolean(selectedProp.isRelationLinkedColumn),
            sourceRelationPropertyId: selectedProp.sourceRelationPropertyId,
            sourceDisplayFieldId: selectedProp.sourceDisplayFieldId,
            sourceTargetCollectionId: selectedProp.sourceTargetCollectionId,
            collectionFields: mappedFields,
          }
        : undefined,
      globalFilter || collectionScope
    );
  };

  const renderPropertySelect = () => (
    <FormSelect
      className="h-9 bg-background dark:bg-background"
      value={property}
      onChange={changeProperty}
      options={[
        { value: '', label: 'Choisir un champ' },
        // Propriétés natives
        ...nativeProperties.map((prop: any) => ({ value: prop.id, label: prop.name })),
        // Propriétés liées via relation
        ...Array.from(linkedPropertiesByRelation.entries()).flatMap(([relationPropId, props]) => {
          const relationProp = (selectedCollection?.properties || []).find((p: any) => p.id === relationPropId);
          return props.map((prop: any) => ({
            value: prop.id,
            label: `${prop.name} (via ${relationProp?.name || 'relation'})`,
          }));
        }),
      ]}
    />
  );

  const needsValue = !['is_empty', 'is_not_empty'].includes(operator);
  const changeCollection = (id: string) => {
    setSelectedTab(collections.findIndex((collection) => collection.id === id));
    setProperty('');
    setValue('');
    setOperator('equals');
  };

  return (
    <ModalWrapper embedded={embedded} title={isEditing ? 'Modifier le filtre' : 'Nouveau filtre'}
      onClose={onClose} onSave={handleSave} saveLabel={isEditing ? 'Enregistrer' : 'Ajouter le filtre'}
      canSave={Boolean(property)} className="max-w-3xl">
      <div className="space-y-4 pt-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {globalFilter || collectionScope
              ? `Visible en haut de toutes les vues${scopeCollectionName ? ` de ${scopeCollectionName}` : ' de cette collection'}.`
              : 'Appliqué uniquement à cette vue.'}
          </p>
          {allowCollectionScope && (
            <IconButton label="Filtre global à la collection" aria-pressed={collectionScope}
              variant={collectionScope ? 'default' : 'outline'} onClick={() => setCollectionScope((global) => !global)}>
              <Globe size={16} />
            </IconButton>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1.5 text-xs font-medium">
            {useCollectionFields ? 'Collection de référence' : 'Collection'}
            <Select value={selectedCollection?.id ?? ''} onValueChange={changeCollection}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Choisir une collection" /></SelectTrigger>
              <SelectContent>{collections.map((collection) =>
                <SelectItem key={collection.id} value={collection.id}>{collection.name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-medium">
            {useCollectionFields ? 'Champ de référence' : 'Champ'}
            {renderPropertySelect()}
          </label>
        </div>
        <label className="grid gap-1.5 text-xs font-medium">
          Condition
          <Select value={operator} onValueChange={setOperator}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{FILTER_OPERATORS.map(({ value, label }) =>
              <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        {needsValue && (
          <div className="grid gap-1.5">
            <p className="text-xs font-medium">Valeur recherchée</p>
            {selectedProp ? (
              <FilterValueDisplay filter={{ property, operator, value }} property={selectedProp} collections={collections}
                currentCollection={selectedCollection} onUpdateValue={setValue} />
            ) : <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">Choisis d’abord un champ.</p>}
          </div>
        )}
        {useCollectionFields && selectedProp && selectedCollection && mappedFields && (
          <FilterCollectionFields collections={collections} sourceCollectionId={selectedCollection.id}
            property={selectedProp} fields={mappedFields} onChange={setCollectionFields} operator={operator} />
        )}
      </div>
    </ModalWrapper>
  );
};

export default FilterModal;

import { SelectOptionsContext } from './select-options-context';
import React from 'react';
import { LightSelect } from '@/components/inputs/LightSelect';
import { useCanEditFields } from '@/lib/hooks/useCanEdit';
import { appendSelectOption, findMatchingOption, optionValue } from '@/lib/utils/selectOptions';
import { normalizeRelationIds } from '@/lib/utils/relationUtils';


export function SelectPropertyField({ property, collectionId, value, onChange, readOnly, className, sizeClass, maxVisible, trigger }: {
  property: any; collectionId?: string; value: any; onChange: (value: any) => void;
  trigger?: React.ReactElement;
  readOnly?: boolean; className?: string; sizeClass?: string; maxVisible?: number;
}) {
  const context = React.useContext(SelectOptionsContext);
  const candidates = context?.collections.filter(collection => collection.properties?.some((field: any) => field.id === property.id && field.type === property.type)) || [];
  const owner = candidates.find(collection => collection.id === collectionId)
    || candidates.find(collection => collection.properties.includes(property))
    || (candidates.length === 1 ? candidates[0] : undefined);
  const canEditField = useCanEditFields(owner?.id);
  const field = owner?.properties.find((field: any) => field.id === property.id) || property;
  const onCreateOption = context && owner && !readOnly && canEditField(property.id) ? (label: string, select: (value: string) => void, appearance?: { color?: string; icon?: string }) => {
    const text = label.trim();
    if (!text) return;
    const existing = findMatchingOption(field.options || [], text);
    if (existing) { select(optionValue(existing)); return; }
    // Select first: item editors may enqueue a collection replacement from their snapshot.
    // Append the schema option last against the latest state so neither update is lost.
    select(text);
    context.setCollections(previous => appendSelectOption(previous, owner.id, property.id, text, appearance));
  } : undefined;
  const common = { options: field.options || [], onChange, onCreateOption, disabled: readOnly, className, sizeClass, trigger };
  return property.type === 'select'
    ? <LightSelect {...common} value={value || ''} />
    : <LightSelect {...common} multiple values={normalizeRelationIds(value)} maxVisible={maxVisible} maxValues={property.maxValues} />;
}

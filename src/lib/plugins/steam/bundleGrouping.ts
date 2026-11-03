import type { Collection, Property } from '@/lib/types';
import { MONTH_NAMES } from '@/lib/utils/dateUtils';
import { readGroupFieldSelections } from '@/lib/groupingSelectionStorage';

/** Resolve linked fields through the parent relation, even when their columns are hidden. */
export function bundleGroupProperty(
  id: string,
  properties: Property[],
  games: Collection,
  bundles: Collection,
): Property | undefined {
  if (games.id === bundles.id) return bundles.properties.find((p) => p.id === id);
  const prop = properties.find((p) => p.id === id);
  const [relationId, fieldId] = id.split('__relcol__');
  const source = games.properties.find(
    (p) => p.id === (prop?.sourceRelationPropertyId || relationId),
  );
  if (source?.type !== 'relation' || source.relation?.targetCollectionId !== bundles.id)
    return undefined;
  return bundles.properties.find((p) => p.id === (prop?.sourceDisplayFieldId || fieldId));
}

export function bundleGroupScheme(
  groups: string[],
  properties: Property[],
  source: Collection,
  bundles: Collection,
  view: any = {},
  activePath?: string,
) {
  const mapped = groups.flatMap((id) => {
    const target = bundleGroupProperty(id, properties, source, bundles);
    return target ? [{ sourceId: id, targetId: target.id }] : [];
  });
  const parts = activePath?.split('/') || [];
  const selection = mapped.flatMap((p) => {
    const value = parts[groups.indexOf(p.sourceId)];
    return value ? [value] : [];
  });
  return {
    ...(activePath !== undefined ? { initialGroupPath: selection.join('/') } : {}),
    groups: [...new Set(mapped.map((p) => p.targetId))],
    groupDisplayMode: view?.groupDisplayMode || 'select',
    groupDisplayModes: Object.fromEntries(
      mapped.map((p) => [
        p.targetId,
        view?.groupDisplayModes?.[p.sourceId] || view?.groupDisplayMode || 'select',
      ]),
    ),
  };
}

export function activeBundleGroupPath(collectionId: string, groups: string[], fallback: string) {
  const saved = readGroupFieldSelections(collectionId);
  // A child selection belongs to the currently selected parent, not to an older branch.
  let path = fallback || '';
  groups.forEach((id, depth) => {
    const choice = saved[id];
    if (!choice || choice.split('/').length !== depth + 1) return;
    if (depth === 0 || choice.startsWith(`${path}/`)) path = choice;
  });
  return path;
}

export function groupValueForBundle(property: Property, value: string, parts: string[]) {
  if (['multiselect', 'multi_select'].includes(property.type)) return [value];
  if (property.type === 'relation')
    return ['one_to_one', 'many_to_one', 'one-to-one', 'many-to-one'].includes(
      property.relation?.type || '',
    )
      ? value
      : [value];
  if (property.type === 'number') return Number(value);
  if (property.type === 'checkbox') return value === 'true';
  if (property.type === 'date') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
    const year =
      value.match(/\b\d{4}\b/)?.[0] ||
      parts.find((p) => /^\d{4}$/.test(p)) ||
      String(new Date().getFullYear());
    const month = MONTH_NAMES.findIndex((name) =>
      value.toLocaleLowerCase('fr').includes(name.toLocaleLowerCase('fr')),
    );
    if (month >= 0) {
      const day =
        !property.dateGranularity || property.dateGranularity === 'full'
          ? value.match(/^(\d{1,2})\s/)?.[1] || '01'
          : '01';
      return `${year}-${String(month + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  }
  return value;
}

export function publicBundleGroupValues(entry: any, bundles: Collection) {
  const values: Record<string, any> = {};
  for (const target of bundles.properties) {
    const source =
      entry.bundleProperties?.find((p: any) => p.id === target.id && p.type === target.type) ||
      entry.bundleProperties?.find((p: any) => p.name === target.name && p.type === target.type);
    if (source && entry.bundle?.[source.id] !== undefined)
      values[target.id] = entry.bundle[source.id];
  }
  return { ...values, id: entry.id, publication: entry };
}

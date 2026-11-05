import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { getRelationItemLabel, getValueLabels } from '@/components/modals/modalLib';
import { MONTH_NAMES } from '@/lib/calendarUtils';
import { normalizeRelationIds } from '@/lib/utils/relationUtils';
import FilterOptionPicker from './FilterOptionPicker';

interface FilterValueDisplayProps {
  filter: { property: string; operator: string; value: any };
  property: any;
  collections: any[];
  currentCollection: any;
  canEdit?: boolean;
  onUpdateValue: (value: any) => void;
  compact?: boolean;
}

export default function FilterValueDisplay({ filter, property, collections, canEdit = true, onUpdateValue, compact = false }: FilterValueDisplayProps) {
  const date = property?.type === 'date' || property?.type === 'date_range';
  const granularity = property?.dateGranularity ?? 'full';
  const select = ['select', 'multiselect', 'multi_select'].includes(property?.type);
  const relation = property?.type === 'relation';
  const multi = ['equals', 'not_equals'].includes(filter.operator) ||
    ['multiselect', 'multi_select'].includes(property?.type) ||
    (relation && ['one_to_many', 'many_to_many'].includes(property?.relation?.type?.replace(/-/g, '_')));
  const options = (() => {
    if (relation) {
      const target = collections.find(({ id }) => id === property.relation?.targetCollectionId);
      return (target?.items ?? []).map((item: any) => ({
        value: item.id,
        label: getRelationItemLabel(item, property.relation, target),
      }));
    }
    if (select) return (property.options ?? []).map((option: any) => typeof option === 'string'
      ? { value: option, label: option }
      : { value: option.value, label: option.label ?? option.value });
    if (date && granularity === 'month') return MONTH_NAMES.map((month) => ({ value: month, label: month }));
    const years = Array.from({ length: 21 }, (_, index) => 2020 + index);
    if (date && granularity === 'year') return years.map((year) => ({ value: String(year), label: String(year) }));
    if (date && granularity === 'month-year') return years.flatMap((year) =>
      MONTH_NAMES.map((month) => ({ value: `${month} ${year}`, label: `${month} ${year}` })));
    return null;
  })();

  const labels = getValueLabels(property, filter.value, collections, normalizeRelationIds).map(String);
  const fullLabel = labels.join(', ');
  const summary = labels.length > 2 ? `${labels[0]} +${labels.length - 1}` : fullLabel;
  if (!canEdit) return <span className="max-w-48 truncate text-xs" title={fullLabel}>{summary || 'Aucune valeur'}</span>;

  // A value with choices opens its checklist directly, including from the collection header.
  if (options) return (
    <FilterOptionPicker options={options} values={normalizeRelationIds(filter.value)} multiple={multi && !date}
      maxValues={property?.maxValues ?? (relation && !['one_to_many', 'many_to_many'].includes((property?.relation?.type ?? 'many_to_many').replace(/-/g, '_')) ? 1 : undefined)} compact={compact} label={`Valeur du filtre · ${property?.name ?? 'Champ'}`}
      onChange={(values) => onUpdateValue(multi && !date ? values : values[0] ?? '')} />
  );

  const inputValue = date
    ? Array.isArray(filter.value) ? filter.value[0] ?? '' : filter.value ?? ''
    : Array.isArray(filter.value) ? filter.value.join(', ') : filter.value ?? '';
  const input = (
    <Input aria-label={`Valeur du filtre · ${property?.name ?? 'Champ'}`} type={date ? 'date' : 'text'}
      value={String(inputValue)} placeholder={multi ? 'Une ou plusieurs valeurs séparées par des virgules' : 'Valeur'}
      onChange={(event) => onUpdateValue(event.target.value)}
      className="h-9" />
  );
  if (!compact) return input;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="h-7 max-w-48 truncate rounded-md px-1 text-xs hover:bg-accent" title={fullLabel}>
          {summary || 'Choisir une valeur'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-3">{input}</PopoverContent>
    </Popover>
  );
}

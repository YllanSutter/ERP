/**
 * Détermine si une colonne Kanban doit être affichée selon les filtres actifs sur le champ de groupement.
 */
export function shouldShowColumn(
  columnValue: string,
  filters: any[],
  groupByPropId: string | null
): boolean {
  if (!groupByPropId || filters.length === 0) return true;

  const filtersOnGroupBy = filters.filter(f => f.property === groupByPropId);
  if (filtersOnGroupBy.length === 0) return true;

  const equalsFilters = filtersOnGroupBy.filter(f => f.operator === 'equals');
  const notEqualsFilters = filtersOnGroupBy.filter(f => f.operator === 'not_equals');
  const otherFilters = filtersOnGroupBy.filter(f => f.operator !== 'equals' && f.operator !== 'not_equals');

  if (equalsFilters.length > 0) {
    const matchesEquals = equalsFilters.some(f =>
      Array.isArray(f.value) ? f.value.includes(columnValue) : columnValue === f.value
    );
    if (!matchesEquals) return false;
  }

  if (notEqualsFilters.length > 0) {
    const matchesNotEquals = notEqualsFilters.some(f =>
      Array.isArray(f.value) ? f.value.includes(columnValue) : columnValue === f.value
    );
    if (matchesNotEquals) return false;
  }

  for (const filter of otherFilters) {
    const filterValue = filter.value;

    if (filter.operator === 'contains') {
      if (Array.isArray(filterValue)) {
        const matches = filterValue.some((fv: any) =>
          columnValue?.toLowerCase().includes(String(fv).toLowerCase())
        );
        if (!matches) return false;
      } else if (!columnValue?.toLowerCase().includes(filterValue?.toLowerCase())) {
        return false;
      }
    } else if (filter.operator === 'not_contains') {
      if (Array.isArray(filterValue)) {
        const matches = filterValue.some((fv: any) =>
          columnValue?.toLowerCase().includes(String(fv).toLowerCase())
        );
        if (matches) return false;
      } else if (columnValue?.toLowerCase().includes(filterValue?.toLowerCase())) {
        return false;
      }
    } else if (filter.operator === 'is_empty') {
      if (columnValue !== 'Sans valeur' && columnValue !== null && columnValue !== '') return false;
    } else if (filter.operator === 'is_not_empty') {
      if (columnValue === 'Sans valeur' || columnValue === null || columnValue === '') return false;
    }
  }

  return true;
}

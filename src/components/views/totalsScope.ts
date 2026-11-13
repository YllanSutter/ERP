export type TotalsScope = 'view' | 'groups' | 'both';

/** Preserve existing grouped views until a scope is explicitly selected. */
export function resolveTotalsScope(scope: unknown, hasGroups: boolean, position?: string): TotalsScope {
  if (!hasGroups) return 'view';
  if (scope === 'view' || scope === 'groups' || scope === 'both') return scope;
  return position && position !== 'none' ? 'both' : 'groups';
}

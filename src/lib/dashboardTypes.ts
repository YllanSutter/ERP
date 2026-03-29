export interface DashboardDateOverride {
  single?: string;
  start?: string;
  end?: string;
}

export interface DashboardColumnNode {
  id: string;
  label: string;
  children?: DashboardColumnNode[];
  typeValues?: string[];
  dateFieldOverride?: DashboardDateOverride;
  durationFieldOverride?: string;
}

/**
 * Types de modules disponibles dans un dashboard.
 * - week_table   : tableau hebdomadaire (lignes = jours ouvrés, colonnes = feuilles)
 * - month_totals : bloc de totaux mensuels (résumé compact par collection)
 * - year_table   : vue annuelle (lignes = mois, colonnes = feuilles)
 * - table        : liste des items de la collection source (vue tableau)
 */
export type DashboardModuleType =
  | 'week_table'
  | 'month_totals'
  | 'year_table'
  | 'table';

export interface DashboardModule {
  id: string;
  type: DashboardModuleType;
  title?: string;
  enabled: boolean;
}

export interface MonthlyDashboardConfig {
  id: string;
  name: string;
  sourceCollectionId: string | null;
  year: number;
  month: number;
  includeWeekends: boolean;
  viewType?: 'recap' | 'table';
  periodScope?: 'month' | 'year';
  recapMetrics?: Array<'count' | 'duration'>;
  tableHiddenFieldsBySection?: Record<string, string[]>;
  typeField: string | null;
  globalDateField?: string | null;
  globalDateRange?: { startField: string | null; endField: string | null };
  globalDurationField?: string | null;
  columnTree: DashboardColumnNode[];
  modules?: DashboardModule[];
  visibleToRoles?: string[];
  visibleToUsers?: string[];
  createdAt?: string;
  updatedAt?: string;
}

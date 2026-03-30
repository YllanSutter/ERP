/**
 * Types pour le nouveau système de dashboard modulaire.
 * Chaque dashboard est une grille de modules configurables indépendamment,
 * chacun pouvant afficher n'importe quel type de vue ou de visualisation.
 */

export type ModuleType =
  | 'table'      // Vue tableau (réutilise TableView)
  | 'kanban'     // Vue kanban (réutilise KanbanView)
  | 'calendar'   // Vue calendrier (réutilise CalendarView)
  | 'chart'      // Graphique (recharts)
  | 'metric'     // Carte KPI / métrique
  | 'list';      // Liste simple d'items

export type ChartType = 'bar' | 'line' | 'area' | 'pie';

export type DateGrouping = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max';

export type GroupMode = 'none' | 'field' | 'week' | 'month' | 'quarter' | 'year';

export type GlobalDatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_30_days'
  | 'this_quarter'
  | 'this_year'
  | 'custom';

export interface ModuleFilter {
  id: string;
  fieldId: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'greater'
    | 'less'
    | 'is_empty'
    | 'is_not_empty';
  value?: any;
}

/** Position/taille dans la grille 12 colonnes */
export interface ModuleLayout {
  w: number;      // largeur : 3, 4, 6, 8, 9 ou 12
  h: number;      // hauteur en px : 200, 300, 400, 500, 650
  order: number;  // ordre d'affichage
}

/** Configuration complète d'un module */
export interface DashboardModuleConfig {
  id: string;
  type: ModuleType;
  title?: string;

  // Source de données
  collectionId?: string;

  // Filtres
  filters?: ModuleFilter[];

  // Champs cachés (pour table/kanban/list)
  hiddenFields?: string[];

  // Groupement
  groupBy?: string;       // fieldId
  groupMode?: GroupMode;
  dateField?: string;     // champ date utilisé pour les groupements temporels

  // Tri
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  sortLimit?: number;     // limite le nombre d'items (ex: top 10)

  // --- Chart ---
  chartType?: ChartType;
  chartXField?: string;           // field pour l'axe X (ou segments)
  chartYField?: string;           // field pour l'axe Y (si aggregation != count)
  chartYAggregation?: AggregationType;
  chartStackBy?: string;          // field pour stacker les barres
  chartDateGrouping?: DateGrouping;
  chartColors?: string[];
  chartShowLegend?: boolean;
  chartShowGrid?: boolean;

  // --- Metric ---
  metricField?: string;
  metricAggregation?: AggregationType;
  metricLabel?: string;
  metricPrefix?: string;
  metricSuffix?: string;
  metricIcon?: string;
  metricColor?: string;

  // --- Table ---
  tableGroups?: string[];
  tableGroupDisplayMode?: 'accordion' | 'columns' | 'tabs';

  // --- Kanban ---
  kanbanGroupBy?: string;

  // --- Calendar ---
  calendarMode?: 'month' | 'week';

  // --- List ---
  listLimit?: number;

  // Layout
  layout: ModuleLayout;
}

/** Configuration globale d'un dashboard */
export interface DashboardConfig {
  id: string;
  name: string;
  modules: DashboardModuleConfig[];

  // Filtre date global (appliqué à tous les modules qui ont un champ date)
  globalDatePreset?: GlobalDatePreset;
  globalDateStart?: string;
  globalDateEnd?: string;
  globalDateField?: string; // ID du champ date cible (sinon auto-detect)

  // Accès
  visibleToRoles?: string[];
  visibleToUsers?: string[];

  createdAt?: string;
  updatedAt?: string;
}

/** Options de largeur disponibles */
export const MODULE_WIDTH_OPTIONS = [
  { value: 3, label: '1/4' },
  { value: 4, label: '1/3' },
  { value: 6, label: '1/2' },
  { value: 8, label: '2/3' },
  { value: 9, label: '3/4' },
  { value: 12, label: 'Pleine largeur' },
] as const;

/** Options de hauteur disponibles */
export const MODULE_HEIGHT_OPTIONS = [
  { value: 200, label: 'XS – 200px' },
  { value: 300, label: 'S – 300px' },
  { value: 400, label: 'M – 400px' },
  { value: 500, label: 'L – 500px' },
  { value: 650, label: 'XL – 650px' },
] as const;

/** Labels lisibles pour les types de modules */
export const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
  table: 'Tableau',
  kanban: 'Kanban',
  calendar: 'Calendrier',
  chart: 'Graphique',
  metric: 'Métrique',
  list: 'Liste',
};

/** Labels lisibles pour les agrégations */
export const AGGREGATION_LABELS: Record<AggregationType, string> = {
  count: 'Nombre',
  sum: 'Somme',
  avg: 'Moyenne',
  min: 'Minimum',
  max: 'Maximum',
};

/** Labels lisibles pour les groupements de dates */
export const DATE_GROUPING_LABELS: Record<DateGrouping, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
  quarter: 'Trimestre',
  year: 'Année',
};

/** Labels lisibles pour les presets de dates globales */
export const GLOBAL_DATE_PRESET_LABELS: Record<GlobalDatePreset, string> = {
  today: "Aujourd'hui",
  this_week: 'Cette semaine',
  this_month: 'Ce mois-ci',
  last_30_days: '30 derniers jours',
  this_quarter: 'Ce trimestre',
  this_year: 'Cette année',
  custom: 'Personnalisé',
};

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
  | 'list'       // Liste simple d'items
  | 'recap';     // Tableau récap semaines × colonnes (ou mois × colonnes)

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

/**
 * Type d'affichage pour une cellule récap.
 * - count    : nombre d'items
 * - sum      : somme d'un champ numérique
 * - duration : somme d'un champ numérique formatée en Xh Ym
 */
export type RecapDisplayType = 'count' | 'sum' | 'duration';

/**
 * Nœud de colonne récap (structure récursive).
 * Un nœud peut être une feuille (displayType) ou avoir des sous-colonnes
 * (automatiques depuis un champ select/multiselect, ou manuelles).
 */
export interface RecapColumn {
  id: string;
  /** Label affiché dans l'en-tête */
  label: string;
  /** Collection source de la colonne (défaut: collection du module) */
  collectionId?: string;
  /** Champ date/date_range source pour la colonne (défaut: champ date du module) */
  dateFieldId?: string;
  /** Couleur de la colonne */
  color?: string;

  // ── Filtrage ─────────────────────────────────────────────────────
  /** Champ sur lequel filtrer */
  filterFieldId?: string;
  /** Valeurs à inclure (vide = tout) */
  filterValues?: string[];

  // ── Affichage (feuille — utilisé quand pas de sous-colonnes) ─────
  /**
   * Types d'affichage de cette colonne.
   * - [] ou absent → hérite des défauts du module parent
   * - [x] → type unique, pas de sous-colonnes par type
   * - [x, y, …] → génère une sous-colonne par type sélectionné
   */
  displayTypes?: RecapDisplayType[];
  /** @deprecated utiliser displayTypes */
  displayType?: RecapDisplayType;
  /** Champ numérique à sommer pour sum/duration */
  aggregationField?: string;
  /** Champ numérique utilisé comme source de temps pour displayType=duration */
  durationField?: string;
  /**
   * Unité du champ durée ('minutes' | 'hours').
   * Défaut : 'minutes'. Si le champ stocke des heures décimales (ex: 1.5 = 1h30), mettre 'hours'.
   */
  durationUnit?: 'minutes' | 'hours';
  /** @deprecated utiliser displayType */
  aggregation?: 'count' | 'sum' | 'avg';

  // ── Sous-colonnes automatiques ────────────────────────────────────
  /** Champ select/multiselect → génère une sous-colonne par option */
  autoSubFieldId?: string;
  /**
   * Types d'affichage pour chaque sous-colonne auto.
   * - [] ou absent → hérite des défauts du module/parent
   * - [x] → type unique
   * - [x, y, …] → génère une sous-sous-colonne par type dans chaque option
   */
  autoSubDisplayTypes?: RecapDisplayType[];
  /** @deprecated utiliser autoSubDisplayTypes */
  autoSubDisplayType?: RecapDisplayType;
  /** Limite les options utilisées en mode auto (vide = toutes les options) */
  autoSubFilterValues?: string[];
  /** Champ numérique pour les sous-colonnes auto si sum/duration */
  autoSubAggregationField?: string;

  // ── Sous-colonnes manuelles ───────────────────────────────────────
  /** Sous-colonnes définies manuellement (mutuellement exclusif avec autoSubFieldId) */
  children?: RecapColumn[];
}

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

  // --- Recap ---
  /** 'month' : tableau par semaines du mois | 'year' : tableau par mois de l'année */
  recapMode?: 'month' | 'year';
  /** Année à afficher (défaut : année courante) */
  recapYear?: number;
  /** Mois à afficher 1-12 (défaut : mois courant, utilisé seulement en mode 'month') */
  recapMonth?: number;
  /** Champ date/date_range utilisé pour la plage */
  recapDateField?: string;
  /** Colonnes configurées par l'utilisateur */
  recapColumns?: RecapColumn[];
  /** Inclure les week-ends dans les lignes (mode mois) */
  recapIncludeWeekends?: boolean;
  /** Jours à masquer en mode mois (0 = dimanche, 6 = samedi) */
  recapHiddenWeekDays?: number[];
  /**
   * Types d'affichage par défaut. Si plusieurs sont sélectionnés, chaque colonne
   * génère automatiquement une sous-colonne par type.
   */
  recapDefaultDisplayTypes?: RecapDisplayType[];
  /** Champ numérique par défaut pour sum/duration */
  recapDefaultAggregationField?: string;
  /** Champ numérique par défaut pour les colonnes duration */
  recapDefaultDurationField?: string;
  /** Unité par défaut pour les colonnes duration ('minutes' | 'hours') */
  recapDefaultDurationUnit?: 'minutes' | 'hours';

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
  recap: 'Récap',
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

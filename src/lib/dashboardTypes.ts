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

export interface MonthlyDashboardConfig {
  id: string;
  name: string;
  sourceCollectionId: string | null;
  year: number;
  month: number;
  includeWeekends: boolean;
  typeField: string | null;
  globalDateField?: string | null;
  globalDateRange?: { startField: string | null; endField: string | null };
  globalDurationField?: string | null;
  columnTree: DashboardColumnNode[];
  createdAt?: string;
  updatedAt?: string;
}

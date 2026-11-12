import { v4 as uuidv4 } from 'uuid';
import React from 'react';
import { getViewLabel } from '@/lib/views';
import type { ModulePeriod } from '@/lib/dashboardTypes';
import { getLayoutSizeOptions, getLayoutTileHeight, LAYOUT_HEIGHT_OPTIONS, LAYOUT_WIDTH_OPTIONS } from '@/lib/layoutDimensions';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface LayoutPanelConfig {
  id: string;
  collectionId?: string;
  viewId: string;
  title?: string;
  period?: ModulePeriod;
  dateField?: string;
  viewSettings?: Record<string, unknown>;
  colSpan?: number;
  rowSpan?: number;
  height?: number;
}

export function getLayoutPanelHeight(panel: LayoutPanelConfig) {
  if (panel.height !== undefined) return getLayoutTileHeight(panel.height);
  const rows = Math.min(6, Math.max(1, panel.rowSpan || 2));
  return rows * 160 + (rows - 1) * 12;
}

interface LayoutPanelsEditorProps {
  panels: LayoutPanelConfig[];
  hideAdd?: boolean;
  onChange: (panels: LayoutPanelConfig[]) => void;
  collection: any;
  collections?: any[];
  views?: Record<string, any[]>;
  availableViews?: any[];
}

/** Shared composition editor used when creating a Layout view and in its live settings. */
const LayoutPanelsEditor: React.FC<LayoutPanelsEditorProps> = ({
  panels,
  hideAdd = false,
  onChange,
  collection,
  collections = [],
  views = {},
  availableViews = [],
}) => {
  const collectionOptions = collections.length ? collections : (collection ? [collection] : []);
  const updatePanel = (index: number, patch: Partial<LayoutPanelConfig>) => {
    onChange(panels.map((panel, panelIndex) => panelIndex === index ? { ...panel, ...patch } : panel));
  };

  return (
    <div className="space-y-2">
      {panels.map((panel, index) => {
        const targetCollectionId = panel.collectionId || collection?.id || '';
        const selectableViews = views[targetCollectionId] || availableViews;
        const width = panel.colSpan || 6;
        const height = getLayoutPanelHeight(panel);
        return (
          <div key={panel.id || index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_3.5rem_3rem_2rem] items-end gap-2">
            <Select value={targetCollectionId || '__none__'} onValueChange={(value) => updatePanel(index, { collectionId: value === '__none__' ? '' : value, viewId: '' })}>
              <SelectTrigger className="h-8 min-w-0 text-xs"><SelectValue placeholder="Collection" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Collection…</SelectItem>
                {collectionOptions.map((entry: any) => <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={panel.viewId || '__none__'} onValueChange={(value) => updatePanel(index, { viewId: value === '__none__' ? '' : value })}>
              <SelectTrigger className="h-8 min-w-0 text-xs"><SelectValue placeholder="Vue" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Choisir une vue…</SelectItem>
                {selectableViews.filter((entry: any) => entry.type !== 'layout').map((entry: any) => <SelectItem key={entry.id} value={entry.id}>{getViewLabel(entry)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(width)} onValueChange={(value) => updatePanel(index, { colSpan: Number(value) })}>
              <SelectTrigger aria-label="Largeur" className="h-8 min-w-0 px-2 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LAYOUT_WIDTH_OPTIONS.map(({ value, label }) => <SelectItem key={value} value={String(value)}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(height)} onValueChange={(value) => updatePanel(index, { height: Number(value) })}>
              <SelectTrigger aria-label="Hauteur" className="h-8 min-w-0 px-2 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {getLayoutSizeOptions(LAYOUT_HEIGHT_OPTIONS, height, `${height} px`).map(({ value, label }) => <SelectItem key={value} value={String(value)}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(panels.filter((_, panelIndex) => panelIndex !== index))} aria-label="Retirer ce panneau" title="Retirer ce panneau"><Trash2 /></Button>
          </div>
        );
      })}
      {!hideAdd && <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...panels, { id: uuidv4(), collectionId: collection?.id || '', viewId: '', colSpan: 6, height: LAYOUT_HEIGHT_OPTIONS[1].value }])}>
        <Plus /> Ajouter un panneau
      </Button>}
    </div>
  );
};

export default LayoutPanelsEditor;

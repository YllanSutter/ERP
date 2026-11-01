import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface LayoutPanelConfig {
  id: string;
  collectionId?: string;
  viewId: string;
  colSpan?: number;
  rowSpan?: number;
}

interface LayoutPanelsEditorProps {
  panels: LayoutPanelConfig[];
  onChange: (panels: LayoutPanelConfig[]) => void;
  collection: any;
  collections?: any[];
  views?: Record<string, any[]>;
  availableViews?: any[];
}

/** Shared composition editor used when creating a Layout view and in its live settings. */
const LayoutPanelsEditor: React.FC<LayoutPanelsEditorProps> = ({
  panels,
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
        return (
          <div key={panel.id || index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_4.5rem_4.5rem_2rem] items-end gap-2">
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
                {selectableViews.filter((entry: any) => entry.type !== 'layout').map((entry: any) => <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(panel.colSpan || 6)} onValueChange={(value) => updatePanel(index, { colSpan: Number(value) })}>
              <SelectTrigger className="h-8 min-w-0 px-2 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{[3, 4, 6, 8, 12].map((value) => <SelectItem key={value} value={String(value)}>{value}/12</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(panel.rowSpan || 2)} onValueChange={(value) => updatePanel(index, { rowSpan: Number(value) })}>
              <SelectTrigger className="h-8 min-w-0 px-2 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4].map((value) => <SelectItem key={value} value={String(value)}>{value} L</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(panels.filter((_, panelIndex) => panelIndex !== index))} aria-label="Retirer ce panneau" title="Retirer ce panneau"><Trash2 /></Button>
          </div>
        );
      })}
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...panels, { id: crypto.randomUUID(), collectionId: collection?.id || '', viewId: '', colSpan: 6, rowSpan: 2 }])}>
        <Plus /> Ajouter un panneau
      </Button>
    </div>
  );
};

export default LayoutPanelsEditor;

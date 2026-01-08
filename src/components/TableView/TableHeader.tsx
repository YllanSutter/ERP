import React from 'react';
import * as Icons from 'lucide-react';
import { Property } from '@/lib/types';

export interface TableHeaderProps {
  visibleProperties: Property[];
  canEdit: boolean;
  onEditProperty: (prop: Property) => void;
  onToggleField: (fieldId: string) => void;
  onDeleteProperty: (propId: string) => void;
}

const TableHeader: React.FC<TableHeaderProps> = ({
  visibleProperties,
  canEdit,
  onEditProperty,
  onToggleField,
  onDeleteProperty,
}) => {
  return (
    <thead className="bg-neutral-900/60 border-b border-white/5">
      <tr>
        {visibleProperties.map((prop: any) => {
          const PropIcon = (Icons as any)[prop.icon] || Icons.Tag;
          return (
            <th
              key={prop.id}
              style={{ backgroundColor: `${prop.color || '#8b5cf6'}10` }}
              className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider"
            >
              <div className="flex items-center gap-2 font-black">
                <PropIcon size={14} />
                {prop.name}
                {canEdit && (
                  <div className="flex gap-1 opacity-0 hover:opacity-100 transition-all duration-500">
                    <button
                      onClick={() => onEditProperty(prop)}
                      className="text-neutral-600 hover:text-cyan-400"
                      title="Modifier la propriété"
                    >
                      <Icons.Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onToggleField(prop.id)}
                      className="text-neutral-600 hover:text-neutral-400"
                      title="Masquer la colonne"
                    >
                      <Icons.EyeOff size={14} />
                    </button>
                    {prop.id !== 'name' && (
                      <button
                        onClick={() => onDeleteProperty(prop.id)}
                        className="text-neutral-600 hover:text-red-500"
                        title="Supprimer la propriété"
                      >
                        <Icons.Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </th>
          );
        })}
        {canEdit && (
          <th className="px-6 py-3 text-right text-xs font-medium text-neutral-400 uppercase">
            Actions
          </th>
        )}
      </tr>
    </thead>
  );
};

export default TableHeader;

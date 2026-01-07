import React from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import EditableProperty from '@/components/EditableProperty';
import { cn } from '@/lib/utils';

interface TableViewProps {
  collection: any;
  items: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  hiddenFields: string[];
  onToggleField: (fieldId: string) => void;
  onDeleteProperty: (propId: string) => void;
  onEditProperty: (prop: any) => void;
  onViewDetail: (item: any) => void;
  collections: any[];
  onRelationChange: (prop: any, item: any, value: any) => void;
  onNavigateToCollection: (collectionId: string, linkedIds?: string[]) => void;
}

const TableView: React.FC<TableViewProps> = ({
  collection,
  items,
  onEdit,
  onDelete,
  hiddenFields,
  onToggleField,
  onDeleteProperty,
  onEditProperty,
  onViewDetail,
  collections,
  onRelationChange,
  onNavigateToCollection,
}) => {
  const visibleProperties = collection.properties.filter((p: any) => !hiddenFields.includes(p.id));

  return (
    <div className="bg-neutral-900/40 border border-white/5 rounded-lg overflow-hidden backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-900/60 border-b border-white/5">
            <tr>
              {visibleProperties.map((prop: any) => {
                const PropIcon = (Icons as any)[prop.icon] || Icons.Tag;
                return (
                  <th key={prop.id} className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <PropIcon size={14} style={{ color: prop.color || '#8b5cf6' }} />
                      {prop.name}
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
                    </div>
                  </th>
                );
              })}
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((item: any) => (
              <motion.tr
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hover:bg-white/5 transition-colors"
              >
                {visibleProperties.map((prop: any) => (
                  <td key={prop.id} className="px-6 py-4 whitespace-nowrap text-sm text-neutral-300">
                    <EditableProperty
                      property={prop}
                      value={item[prop.id]}
                      onChange={(val) => onEdit({ ...item, [prop.id]: val })}
                      size="md"
                      isNameField={prop.id === 'name' || prop.name === 'Nom'}
                      onViewDetail={prop.id === 'name' || prop.name === 'Nom' ? () => onViewDetail(item) : undefined}
                      collections={collections}
                      currentItem={item}
                      onRelationChange={onRelationChange}
                      onNavigateToCollection={onNavigateToCollection}
                    />
                  </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-400">
                    <Icons.Trash2 size={16} />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableView;

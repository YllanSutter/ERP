import React from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import EditableProperty from '@/components/EditableProperty';
import { Item, Property, Collection } from '@/lib/types';

export interface TableItemRowProps {
  item: Item;
  visibleProperties: Property[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onViewDetail: (item: Item) => void;
  collections: Collection[];
  onRelationChange: (prop: Property, item: Item, value: any) => void;
  onNavigateToCollection: (collectionId: string, linkedIds?: string[]) => void;
  canEdit: boolean;
  canEditField: (fieldId: string) => boolean;
  paddingLeft?: number;
  animate?: boolean;
}

const TableItemRow: React.FC<TableItemRowProps> = ({
  item,
  visibleProperties,
  onEdit,
  onDelete,
  onViewDetail,
  collections,
  onRelationChange,
  onNavigateToCollection,
  canEdit,
  canEditField,
  paddingLeft = 24,
  animate = true,
}) => {
  const RowComponent = animate ? motion.tr : 'tr';
  const motionProps = animate
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
      }
    : {};

  return (
    <RowComponent
      {...motionProps}
      className="hover:bg-white/5 transition-colors border-b border-white/5"
    >
      {visibleProperties.map((prop: any, index: number) => (
        <td
          key={prop.id}
          className="px-6 py-4 whitespace-nowrap text-sm text-neutral-300"
          style={index === 0 ? { paddingLeft: `${paddingLeft}px` } : undefined}
        >
          <EditableProperty
            property={prop}
            value={item[prop.id]}
            onChange={(val) => onEdit({ ...item, [prop.id]: val })}
            size="md"
            isNameField={prop.id === 'name' || prop.name === 'Nom'}
            onViewDetail={prop.id === 'name' || prop.name === 'Nom' ? () => onViewDetail(item) : undefined}
            disableNameLink={true}
            collections={collections}
            currentItem={item}
            onRelationChange={onRelationChange}
            onNavigateToCollection={onNavigateToCollection}
            readOnly={!canEdit || !canEditField(prop.id)}
          />
        </td>
      ))}
      {canEdit && (
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
          <div className="flex items-center justify-end gap-3 text-neutral-500">
            <Icons.GripVertical size={16} className="cursor-grab" />
            <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-400">
              <Icons.Trash2 size={16} />
            </button>
          </div>
        </td>
      )}
    </RowComponent>
  );
};

export default React.memo(TableItemRow);

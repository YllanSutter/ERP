import React from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collections: any[];
  activeCollection: string | null;
  onSelectCollection: (collectionId: string) => void;
  onEditCollection: (collection: any) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  collections,
  activeCollection,
  onSelectCollection,
  onEditCollection
}) => {
  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="w-64 border-r border-white/5 bg-neutral-950/50 backdrop-blur overflow-y-auto p-4"
    >
      <h2 className="text-xs font-semibold text-neutral-500 uppercase mb-4 pl-2">Collections</h2>
      {collections.map((col, i) => {
        const IconComponent = (Icons as any)[col.icon] || Icons.Folder;
        return (
          <motion.div
            key={col.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i }}
            className="group relative mb-2"
          >
            <button
              onClick={() => onSelectCollection(col.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 pr-10 py-2.5 rounded-lg transition-all',
                activeCollection === col.id
                  ? 'bg-gradient-to-r from-violet-500/30 to-cyan-500/30 border border-violet-500/50 text-white'
                  : 'hover:bg-white/5 text-neutral-400 hover:text-white'
              )}
              style={
                activeCollection === col.id
                  ? {
                      borderColor: `${col.color}80`,
                      background: `linear-gradient(to right, ${col.color}30, ${col.color}10)`
                    }
                  : {}
              }
            >
              <IconComponent size={20} style={{ color: col.color || '#8b5cf6' }} />
              <span className="font-medium flex-1 text-left">{col.name}</span>
              <span className="text-xs text-neutral-500 bg-white/5 px-2 py-1 rounded">
                {col.items.length}
              </span>
            </button>
            <button
              onClick={() => onEditCollection(col)}
              className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
              title="Éditer la collection"
            >
              <Settings size={16} />
            </button>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default Sidebar;

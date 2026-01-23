import React from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';

export interface GroupHeaderProps {
  groupPath: string;
  label: string;
  propertyName: string;
  itemCount: number;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
  colSpan: number;
}

const GroupHeader: React.FC<GroupHeaderProps> = ({
  groupPath,
  label,
  propertyName,
  itemCount,
  depth,
  isExpanded,
  onToggle,
  colSpan,
}) => {
  return (
    <tr className="bg-gray-200 dark:bg-neutral-800/40 hover:bg-gray-300/60  dark:hover:bg-neutral-800/60 border-b border-black/10 dark:border-white/5">
      <td colSpan={colSpan} className="px-6 py-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-sm font-semibold text-neutral-600 dark:text-white transition-colors"
        >
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            className="flex items-center justify-center"
          >
            <Icons.ChevronRight size={18} />
          </motion.div>
          <span style={{ marginLeft: `${depth * 20}px` }}>
            {propertyName}: <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
          </span>
          <span className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded ml-2">
            {itemCount}
          </span>
        </button>
      </td>
    </tr>
  );
};

export default GroupHeader;

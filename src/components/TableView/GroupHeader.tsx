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
  showChevron?: boolean;
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
  showChevron = true,
}) => {
  const indent = Math.max(0, depth) * 14;

  return (
    <tr className="bg-gray-200 dark:bg-neutral-800/40 hover:bg-gray-300/60 dark:hover:bg-neutral-800/60 border-b border-black/10 dark:border-white/5">
      <td colSpan={colSpan} className="px-6 py-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-sm font-semibold text-neutral-600 dark:text-white transition-colors w-full text-left"
        >
          {depth > 0 && (
            <span
              className="inline-block h-5 w-[2px] rounded-full bg-violet-500/50"
              style={{ marginLeft: `${indent - 8}px` }}
            />
          )}
          {showChevron ? (
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              className="flex items-center justify-center"
            >
              <Icons.ChevronRight size={18} />
            </motion.div>
          ) : (
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-500/70" />
          )}
          <span style={{ marginLeft: `${depth > 0 ? 4 : 0}px` }} className="min-w-0 truncate">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mr-2">{propertyName}</span>
            <span className="text-neutral-700 dark:text-white">{label}</span>
          </span>
          <span className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded ml-auto">
            {itemCount}
          </span>
        </button>
      </td>
    </tr>
  );
};

export default GroupHeader;

import React from 'react';
import * as Icons from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface ViewGroupTabItem {
  id: string;
  label: string;
  itemCount: number;
  icon?: string;
  color?: string;
}

interface ViewGroupTabsProps {
  items: ViewGroupTabItem[];
  activeId?: string;
  className?: string;
}

const ViewGroupTabs: React.FC<ViewGroupTabsProps> = ({ items, activeId, className = '' }) => (
  <TabsList className={`h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0 ${className}`}>
    {items.map((item) => {
      const GroupIcon = item.icon ? (Icons as any)[item.icon] : null;
      const isActive = activeId === item.id;

      return (
        <TabsTrigger
          key={item.id}
          value={item.id}
          className="rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-xs dark:border-white/10 dark:bg-white/5"
          style={item.color ? {
            borderColor: `${item.color}55`,
            backgroundColor: isActive ? `${item.color}30` : `${item.color}1a`,
            color: isActive ? item.color : undefined,
          } : undefined}
        >
          <span className="inline-flex items-center gap-1.5">
            {GroupIcon ? <GroupIcon size={12} style={{ color: item.color || undefined }} /> : null}
            <span>{item.label} ({item.itemCount})</span>
          </span>
        </TabsTrigger>
      );
    })}
  </TabsList>
);

export default ViewGroupTabs;

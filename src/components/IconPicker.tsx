import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  className?: string;
  mode?: 'popular' | 'all';
}

// Liste fixe de vrais noms d'icônes lucide-react qui existent
const simpleIcons = [
  'User', 'Users', 'Building2', 'Globe', 'Mail', 'Phone', 'Calendar',
  'Clock', 'FileText', 'Folder', 'Package', 'Briefcase',
  'ShoppingCart', 'Truck', 'Home', 'MapPin',
  'Tag', 'DollarSign', 'CreditCard', 'Wallet', 'TrendingUp', 'TrendingDown',
  'BarChart2', 'PieChart', 'Activity', 'Zap', 'Heart', 'Star', 'Award',
  'Target', 'Flag', 'Bookmark', 'Bell', 'Settings', 'Wrench',
  'Cpu', 'Database', 'Server', 'Monitor', 'Laptop', 'Camera', 'Music',
  'MessageSquare', 'Send', 'Link', 'Download', 'Upload', 'Save'
];

const IconPicker: React.FC<IconPickerProps> = ({ value, onChange, className, mode = 'popular' }) => {
  const [search, setSearch] = useState('');

  const filteredIcons = search
    ? simpleIcons.filter(icon => icon.toLowerCase().includes(search.toLowerCase()))
    : simpleIcons;

  const getIcon = (iconName: string) => {
    // Même approche que dans l'app
    return (Icons as any)[iconName] || (Icons as any).Folder;
  };

  const SelectedIcon = getIcon(value);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une icône..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-500/20 border border-violet-500/50 text-violet-300">
          <SelectedIcon size={20} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1 bg-neutral-800/30 rounded-lg">
        {filteredIcons.map((iconName) => {
          const IconComponent = getIcon(iconName);
          return (
            <button
              key={iconName}
              onClick={() => onChange(iconName)}
              className={cn(
                "flex items-center justify-center p-2 rounded-lg transition-all hover:bg-white/10 text-white",
                value === iconName
                  ? 'bg-violet-500/30 border border-violet-500'
                  : 'border border-transparent hover:text-white'
              )}
              title={iconName}
            >
              <IconComponent size={14} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default IconPicker;

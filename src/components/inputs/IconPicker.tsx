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

// Liste étendue d'icônes lucide-react
const simpleIcons = [
  // Personnes & organisation
  'User', 'Users', 'UserCheck', 'UserPlus', 'UserCog', 'Contact', 'Building', 'Building2', 'Landmark', 'School', 'Hospital',
  // Communication
  'Mail', 'MailOpen', 'Phone', 'PhoneCall', 'MessageSquare', 'MessageCircle', 'Send', 'Inbox', 'AtSign', 'Bell', 'BellRing',
  // Navigation & lieux
  'Globe', 'Globe2', 'Map', 'MapPin', 'Navigation', 'Home', 'Hotel', 'Plane', 'Car', 'Truck', 'Ship', 'Train',
  // Temps & calendrier
  'Calendar', 'CalendarDays', 'CalendarCheck', 'Clock', 'Timer', 'Watch', 'AlarmClock', 'Hourglass',
  // Fichiers & documents
  'File', 'FileText', 'FileImage', 'FilePlus', 'FileCheck', 'Folder', 'FolderOpen', 'Archive', 'Paperclip', 'ClipboardList', 'Clipboard', 'BookOpen', 'Book', 'Notebook',
  // Commerce & finance
  'DollarSign', 'Euro', 'CreditCard', 'Wallet', 'Receipt', 'ShoppingCart', 'ShoppingBag', 'Package', 'Package2', 'Barcode', 'Tag', 'Tags',
  // Graphiques & données
  'TrendingUp', 'TrendingDown', 'BarChart', 'BarChart2', 'BarChart3', 'PieChart', 'LineChart', 'Activity', 'Sigma', 'Hash',
  // Actions UI
  'Search', 'Filter', 'Settings', 'Settings2', 'Sliders', 'SlidersHorizontal', 'MoreHorizontal', 'MoreVertical', 'Menu', 'List', 'LayoutList', 'LayoutGrid',
  // Statuts & signaux
  'CheckCircle', 'XCircle', 'AlertCircle', 'AlertTriangle', 'Info', 'HelpCircle', 'Flag', 'Bookmark', 'Star', 'Heart', 'ThumbsUp', 'Award', 'Target', 'Trophy',
  // Tech & outils
  'Cpu', 'Database', 'Server', 'Monitor', 'Laptop', 'Smartphone', 'Tablet', 'Keyboard', 'Mouse', 'Wifi', 'Bluetooth', 'Cloud', 'Code', 'Terminal', 'GitBranch',
  // Médias
  'Camera', 'Video', 'Music', 'Image', 'Mic', 'Volume2', 'Play', 'Pause',
  // Outils & construction
  'Wrench', 'Hammer', 'Scissors', 'Pen', 'Pencil', 'Brush', 'Ruler', 'Compass',
  // Nature & divers
  'Sun', 'Moon', 'Cloud', 'Zap', 'Flame', 'Leaf', 'Tree', 'Flower2', 'Globe',
  // Connexions
  'Link', 'Link2', 'GitMerge', 'Layers', 'Network', 'Share2', 'ExternalLink',
  // Transferts
  'Download', 'Upload', 'Save', 'RefreshCw', 'RotateCcw', 'ArrowRight', 'ArrowLeft',
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
    <div className={cn("w-72 bg-neutral-900 border border-white/10 rounded-xl shadow-xl p-3 space-y-3", className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-800 border border-white/10 rounded-lg text-white text-sm placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/50 text-violet-300 shrink-0">
          <SelectedIcon size={16} />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1 max-h-60 overflow-y-auto">
        {filteredIcons.map((iconName) => {
          const IconComponent = getIcon(iconName);
          return (
            <button
              key={iconName}
              onClick={() => onChange(iconName)}
              className={cn(
                "flex items-center justify-center p-2 rounded-lg transition-all hover:bg-white/10 text-neutral-300",
                value === iconName
                  ? 'bg-violet-500/30 border border-violet-500 text-violet-300'
                  : 'border border-transparent'
              )}
              title={iconName}
            >
              <IconComponent size={15} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default IconPicker;

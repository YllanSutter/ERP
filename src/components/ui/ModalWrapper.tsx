import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Trash2 } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import IconPicker from '@/components/inputs/IconPicker';
import ColorPicker from '@/components/inputs/ColorPicker';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Type, Hash, ChevronDown, ListChecks, Calendar, CalendarRange, ToggleLeft, Link, Mail, Phone, GitMerge, AlignLeft } from 'lucide-react';

// ─── Modal shell ──────────────────────────────────────────────────────────────

const SIZE_CLS = {
  sm: 'w-full max-w-sm',
  md: 'w-full max-w-lg',
  lg: 'w-full max-w-2xl',
};

interface ModalWrapperProps {
  title: string | React.ReactNode;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  children: React.ReactNode;
  /** Boutons additionnels insérés entre Annuler et Enregistrer (ex: bouton de suppression) */
  extraActions?: React.ReactNode;
  canSave?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** z-index du backdrop (défaut 200, utiliser 300+ pour un overlay sur une autre modale) */
  zIndex?: number;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({
  title,
  onClose,
  onSave,
  saveLabel = 'Enregistrer',
  children,
  extraActions,
  canSave = true,
  size = 'md',
  className,
  zIndex = 200,
}) => {
  const titleEl = typeof title === 'string'
    ? <h3 className="text-lg font-semibold">{title}</h3>
    : title;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center px-4"
      style={{ zIndex }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          'bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl max-h-[85vh] overflow-y-auto backdrop-blur',
          SIZE_CLS[size],
          className
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-black/10 dark:border-white/10">
          {titleEl}
        </div>
        <div className="px-6 pt-5 pb-2">
          {children}
        </div>
        {onSave && (
          <div className="flex items-center gap-3 px-6 py-4 border-t border-black/10 dark:border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              Annuler
            </button>
            {extraActions}
            <div className="flex-1" />
            <ShinyButton
              onClick={onSave}
              className={cn('px-6', !canSave && 'opacity-60 pointer-events-none')}
            >
              {saveLabel}
            </ShinyButton>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ModalWrapper;

// ─── Form primitives ──────────────────────────────────────────────────────────

export const BUILTIN_PROPERTY_TYPES = [
  { value: 'text',         label: 'Texte',       icon: Type },
  { value: 'number',       label: 'Nombre',      icon: Hash },
  { value: 'select',       label: 'Sélection',   icon: ChevronDown },
  { value: 'multi_select', label: 'Multi-sel.',  icon: ListChecks },
  { value: 'date',         label: 'Date',        icon: Calendar },
  { value: 'date_range',   label: 'Période',     icon: CalendarRange },
  { value: 'checkbox',     label: 'Checkbox',    icon: ToggleLeft },
  { value: 'url',          label: 'URL',         icon: Link },
  { value: 'email',        label: 'Email',       icon: Mail },
  { value: 'phone',        label: 'Téléphone',   icon: Phone },
  { value: 'relation',     label: 'Relation',    icon: GitMerge },
  { value: 'rich_text',    label: 'Texte riche', icon: AlignLeft },
];

export interface FormSelectOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

const INPUT_CLS = 'w-full px-4 py-2 bg-gray-300 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none';
const LABEL_CLS = 'block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2';

interface FormFieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

/** Bloc label + contenu + hint optionnel */
export const FormField: React.FC<FormFieldProps> = ({ label, hint, children, className }) => (
  <div className={className}>
    <label className={LABEL_CLS}>{label}</label>
    {children}
    {hint && <FormHint>{hint}</FormHint>}
  </div>
);

/** Input texte stylisé */
export const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input {...props} className={cn(INPUT_CLS, className)} />
);

const SELECT_TRIGGER_CLS = 'w-full h-9 px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white text-sm shadow-none focus:ring-1 focus:ring-violet-500';

const EMPTY_SENTINEL = '__FORM_SELECT_EMPTY__';

interface FormSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  className?: string;
  disabled?: boolean;
}

/** Select Radix UI stylisé — remplace le select natif dans toutes les modales */
export const FormSelect: React.FC<FormSelectProps> = ({ value, onChange, options, className, disabled }) => {
  const strVal = String(value ?? '');
  const radixVal = strVal === '' ? EMPTY_SENTINEL : strVal;
  const currentOpt = options.find(o => o.value === strVal);
  const Icon = currentOpt?.icon;

  return (
    <Select value={radixVal} onValueChange={(v) => onChange(v === EMPTY_SENTINEL ? '' : v)} disabled={disabled}>
      <SelectTrigger className={cn(SELECT_TRIGGER_CLS, className)}>
        <span className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {Icon && <Icon size={13} className="shrink-0 opacity-70" />}
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map(({ value: v, label, icon: OptIcon }) => (
          <SelectItem key={v === '' ? EMPTY_SENTINEL : v} value={v === '' ? EMPTY_SENTINEL : v}>
            <span className="flex items-center gap-2">
              {OptIcon && <OptIcon size={13} className="opacity-70" />}
              {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/** Texte d'aide sous un champ */
export const FormHint: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cn('text-xs text-neutral-500 mt-1', className)}>{children}</p>
);

/** Input date stylisé */
export const FormDateInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input type="date" {...props} className={cn(INPUT_CLS, className)} />
);

/** Bloc de section avec titre */
interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}
export const FormSection: React.FC<FormSectionProps> = ({ title, children, className, action }) => (
  <div className={cn('bg-black/5 dark:bg-white/5 rounded-xl p-4', className)}>
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">{title}</p>
      {action}
    </div>
    {children}
  </div>
);

interface FormCheckboxProps {
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** Checkbox avec label inline */
export const FormCheckbox: React.FC<FormCheckboxProps> = ({ label, checked, onChange, disabled, className }) => (
  <label className={cn('flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer', className)}>
    <input
      type="checkbox"
      className="w-4 h-4 rounded accent-violet-500 cursor-pointer"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
    />
    {label}
  </label>
);

interface FormRadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
}
interface FormRadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: FormRadioOption[];
  accentClass?: string;
  className?: string;
}

/** Groupe de boutons radio stylisés */
export const FormRadioGroup: React.FC<FormRadioGroupProps> = ({ value, onChange, options, accentClass = 'accent-violet-500', className }) => (
  <div className={cn('space-y-2', className)}>
    {options.map(opt => (
      <label
        key={opt.value}
        className="flex items-center gap-3 p-3 rounded-lg border border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20 cursor-pointer transition-colors"
      >
        <input
          type="radio"
          className={cn('w-4 h-4', accentClass)}
          checked={value === opt.value}
          onChange={() => onChange(opt.value)}
        />
        <div>
          <div className="font-medium text-sm text-neutral-800 dark:text-neutral-100">{opt.label}</div>
          {opt.description && <div className="text-xs text-neutral-500">{opt.description}</div>}
        </div>
      </label>
    ))}
  </div>
);

interface FormNameInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  icon: string;
  onIconChange: (icon: string) => void;
  color: string;
  onColorChange: (color: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
}

/** Champ Nom avec icône et couleur intégrées */
export const FormNameInput: React.FC<FormNameInputProps> = ({
  label = 'Nom',
  value,
  onChange,
  icon,
  onIconChange,
  color,
  onColorChange,
  placeholder,
  autoFocus,
  required,
}) => {
  const [showIconPopover, setShowIconPopover] = useState(false);
  const [showColorPopover, setShowColorPopover] = useState(false);

  return (
    <div className="relative">
      {label && (
        <label className={LABEL_CLS}>{label}{required && ' *'}</label>
      )}
      <div className="flex items-stretch rounded-lg border border-black/10 dark:border-white/10 focus-within:border-violet-500 bg-gray-300 dark:bg-neutral-800/50 transition-colors">
        <button
          type="button"
          onClick={() => { setShowIconPopover(v => !v); setShowColorPopover(false); }}
          className="px-3 flex items-center rounded-l-lg border-r border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
          title="Choisir une icône"
          style={{ color }}
        >
          {(Icons as any)[icon]
            ? React.createElement((Icons as any)[icon], { size: 16 })
            : <Icons.Tag size={16} />}
        </button>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 px-3 py-2 bg-transparent text-neutral-700 dark:text-white placeholder-neutral-400 outline-none min-w-0"
        />
        <button
          type="button"
          onClick={() => { setShowColorPopover(v => !v); setShowIconPopover(false); }}
          className="px-3 flex items-center rounded-r-lg border-l border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
          title="Choisir une couleur"
        >
          <span className="w-4 h-4 rounded-full block border border-black/10 dark:border-white/20" style={{ backgroundColor: color }} />
        </button>
      </div>
      {showIconPopover && (
        <div className="absolute top-full left-0 mt-1 z-50">
          <IconPicker value={icon} onChange={(val) => { onIconChange(val); setShowIconPopover(false); }} />
        </div>
      )}
      {showColorPopover && (
        <div className="absolute top-full right-0 mt-1 z-50">
          <ColorPicker value={color} onChange={onColorChange} />
        </div>
      )}
    </div>
  );
};

interface DeleteConfirmButtonProps {
  onDelete: () => void;
  className?: string;
  title?: string;
}

/** Bouton suppression deux étapes — 1er clic : demande confirmation, 2e clic : supprime */
export const DeleteConfirmButton: React.FC<DeleteConfirmButtonProps> = ({ onDelete, className, title = 'Supprimer' }) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {confirming && (
        <button
          onClick={() => setConfirming(false)}
          className="px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-sm"
        >
          Confirmer suppression ?
        </button>
      )}
      <button
        onClick={confirming ? onDelete : () => setConfirming(true)}
        className={cn(
          'px-4 py-2 rounded-lg transition-colors',
          confirming ? 'bg-red-600/80 hover:bg-red-600 text-white' : 'bg-white/5 hover:bg-white/10'
        )}
        title={title}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface FormTabsProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Barre d'onglets pour les modales multi-sections */
export const FormTabs: React.FC<FormTabsProps> = ({ tabs, active, onChange, className }) => (
  <div className={cn('flex gap-0.5 border-b border-black/10 dark:border-white/10 -mx-6 px-6 mb-5', className)}>
    {tabs.map(tab => (
      <button
        key={tab.id}
        type="button"
        onClick={() => onChange(tab.id)}
        className={cn(
          'px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors',
          active === tab.id
            ? 'border-violet-500 text-violet-600 dark:text-violet-400'
            : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
        )}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

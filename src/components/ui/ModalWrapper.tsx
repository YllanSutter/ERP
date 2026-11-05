import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { Button } from './button';
import IconPicker from '@/components/inputs/IconPicker';
import ColorPicker from '@/components/inputs/ColorPicker';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { SettingsDialog, SettingsBody, SettingsFooter, SettingsSection, SettingsSectionTitle, SettingsLabel, SettingsHint, SettingsSelect, type SettingsSelectOption, type SettingsSelectProps } from './settings-panel';
import { Type, Hash, ChevronDown, ListChecks, Calendar, CalendarRange, ToggleLeft, Link, Mail, Phone, GitMerge, AlignLeft } from 'lucide-react';

// ─── Modal shell ──────────────────────────────────────────────────────────────

const SIZE_CLS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
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
  embedded?: boolean;
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
  embedded = false,
}) => {
  const actions = onSave && (
    <SettingsFooter className={embedded ? 'settings-footer-inset sticky bottom-0' : undefined}>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
      {extraActions}
      <Button type="button" size="sm" onClick={onSave} disabled={!canSave}>{saveLabel}</Button>
    </SettingsFooter>
  );
  if (embedded) {
    return (
      <div className="settings-surface">
        {typeof title === 'string' ? <SettingsSectionTitle>{title}</SettingsSectionTitle> : title}
        {children}
        {actions}
      </div>
    );
  }
  return (
    <SettingsDialog open title={title} layer={zIndex}
      onOpenChange={(open) => { if (!open) onClose(); }} className={cn(SIZE_CLS[size], className)}>
      <SettingsBody>{children}</SettingsBody>
      {actions}
    </SettingsDialog>
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

interface FormFieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

/** Bloc label + contenu + hint optionnel */
export const FormField: React.FC<FormFieldProps> = ({ label, hint, children, className }) => (
  <div className={className}>
    <label className="mb-1"><SettingsLabel>{label}</SettingsLabel></label>
    {children}
    {hint && <FormHint>{hint}</FormHint>}
  </div>
);

/** Input texte stylisé */
export const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <Input {...props} className={cn('settings-control', className)} />
);

export type FormSelectOption = SettingsSelectOption;
type FormSelectProps = SettingsSelectProps;

/** Compatibility entry point; all settings select styling lives in SettingsSelect. */
export const FormSelect: React.FC<FormSelectProps> = (props) => <SettingsSelect {...props} />;

/** Texte d'aide sous un champ */
export const FormHint: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <SettingsHint className={className}>{children}</SettingsHint>
);

/** Input date stylisé */
export const FormDateInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <Input type="date" {...props} className={cn('settings-control', className)} />
);

/** Bloc de section avec titre */
interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}
export const FormSection: React.FC<FormSectionProps> = ({ title, children, className, action }) => (
  <SettingsSection title={title} className={className} action={action}>{children}</SettingsSection>
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
      className="w-4 h-4 rounded accent-brand-500 cursor-pointer"
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
export const FormRadioGroup: React.FC<FormRadioGroupProps> = ({ value, onChange, options, accentClass = 'accent-brand-500', className }) => (
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
        <label className="settings-label mb-1">{label}{required && ' *'}</label>
      )}
      <div className="flex items-stretch rounded-lg border border-black/10 dark:border-white/10 focus-within:border-brand-500 bg-gray-300 dark:bg-neutral-800/50 transition-colors">
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
  <div className={cn('settings-tabs-list', className)}>
    {tabs.map(tab => (
      <button
        key={tab.id}
        type="button"
        onClick={() => onChange(tab.id)}
        data-state={active === tab.id ? 'active' : 'inactive'}
        className="settings-tab-trigger"
      >
        {tab.label}
      </button>
    ))}
  </div>
);

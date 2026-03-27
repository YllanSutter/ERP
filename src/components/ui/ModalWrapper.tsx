import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import IconPicker from '@/components/inputs/IconPicker';
import ColorPicker from '@/components/inputs/ColorPicker';
import { cn } from '@/lib/utils';

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
}) => {
  const titleEl = typeof title === 'string'
    ? <h3 className="text-lg font-semibold">{title}</h3>
    : title;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200] px-4"
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

const INPUT_CLS = 'w-full px-4 py-2 bg-gray-300 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none';
const SELECT_CLS = 'w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none';
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

/** Select natif stylisé */
export const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }> = ({ className, children, ...props }) => (
  <select {...props} className={cn(SELECT_CLS, className)}>
    {children}
  </select>
);

/** Texte d'aide sous un champ */
export const FormHint: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cn('text-xs text-neutral-500 mt-1', className)}>{children}</p>
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
  <label className={cn('flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300', className)}>
    <input
      type="checkbox"
      className="accent-violet-500"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
    />
    {label}
  </label>
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

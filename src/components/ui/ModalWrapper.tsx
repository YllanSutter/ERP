import React from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ui/ShinyButton';
import { cn } from '@/lib/utils';

// ─── Modal shell ──────────────────────────────────────────────────────────────

interface ModalWrapperProps {
  title: string | React.ReactNode;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  children: React.ReactNode;
  /** Boutons additionnels insérés entre Annuler et Enregistrer (ex: bouton de suppression) */
  extraActions?: React.ReactNode;
  canSave?: boolean;
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
  className,
}) => {
  const titleEl = typeof title === 'string'
    ? <h3 className="text-xl font-bold mb-6">{title}</h3>
    : title;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          'bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl p-8 min-w-96 max-h-[80vh] overflow-y-auto backdrop-blur',
          className
        )}
        onClick={e => e.stopPropagation()}
      >
        {titleEl}
        {children}
        {onSave && (
          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              Annuler
            </button>
            {extraActions}
            <ShinyButton
              onClick={onSave}
              className={cn('flex-1', !canSave && 'opacity-60 pointer-events-none')}
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

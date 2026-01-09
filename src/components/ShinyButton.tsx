import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ShinyButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const ShinyButton: React.FC<ShinyButtonProps> = ({ children, className, onClick, type = 'button', disabled }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={cn(
        'group relative isolate overflow-hidden rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-6 py-2 text-sm font-medium text-white transition-all',
        'shadow-[0_0_20px_-5px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_-5px_rgba(139,92,246,0.5)]',
        disabled ? 'opacity-60 pointer-events-none' : '',
        className
      )}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
};

export default ShinyButton;

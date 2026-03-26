// Ré-export de compatibilité — la logique est dans LightSelect.tsx
import React from 'react';
import { LightSelect, LightSelectProps, OptionType } from './LightSelect';

export type { OptionType };
export type LightMultiSelectProps = Omit<Extract<LightSelectProps, { multiple: true }>, 'multiple'>;

export const LightMultiSelect: React.FC<LightMultiSelectProps> = (props) => (
  <LightSelect multiple {...props} />
);

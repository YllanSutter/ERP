import React from 'react';
import TotalsBar, { type TotalsBarProps } from '@/components/TableView/TotalsBar';
import type { GroupTotalConfig } from '@/lib/types';

type Props = Pick<TotalsBarProps, 'displayProperties' | 'items' | 'totalFields' | 'calculateTotal' | 'formatTotal'> & {
  config?: GroupTotalConfig;
  position: 'top' | 'bottom';
};

export default function TableGroupTotals({ config, position, ...props }: Props) {
  const configuredPosition = config?.position || 'bottom';
  if (config?.enabled === false || (configuredPosition !== 'both' && configuredPosition !== position)) return null;
  if (!Object.keys(props.totalFields).length || !props.items.length) return null;
  return <div className="border-y border-border px-3 py-2" data-group-total-position={position}>
    <TotalsBar {...props} variant="inline" inlineMode="plain" />
  </div>;
}

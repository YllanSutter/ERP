import React from 'react';
import TableView from './TableView';
import type { TableViewProps } from '@/lib/types';

type CardsViewProps = Omit<TableViewProps, 'displayAsCards'> & {
  cardStyleFieldId?: string;
};

/**
 * Card renderer compatibility boundary.
 *
 * The implementation still reuses the table data/grouping pipeline while the
 * card-specific renderer is migrated out of the legacy component.
 */
const CardsView: React.FC<CardsViewProps> = (props) => (
  <TableView {...props} displayAsCards />
);

export default CardsView;

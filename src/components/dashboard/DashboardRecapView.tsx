import React from 'react';

interface DashboardRecapViewProps {
  groupedWeeks: { week: number; days: Date[] }[];
  renderWeekTable: (week: { week: number; days: Date[] }) => React.ReactNode;
  renderMonthTotals: () => React.ReactNode;
}

const DashboardRecapView: React.FC<DashboardRecapViewProps> = ({
  groupedWeeks,
  renderWeekTable,
  renderMonthTotals,
}) => {
  return (
    <>
      {groupedWeeks.map((week) => renderWeekTable(week))}
      {renderMonthTotals()}
    </>
  );
};

export default DashboardRecapView;

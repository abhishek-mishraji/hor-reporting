import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../session/SessionContext.jsx';
import { getMonthlyDepartments, getCsvUrl } from '../api/reports.js';
import { groupBySalesClass } from '../reportColumns.js';
import { formatCell } from '../format.js';
import { ReportTable } from '../ui/ReportTable.jsx';
import { ReportStatus } from '../ui/ReportStatus.jsx';
import { KpiSummaryGrid } from '../ui/KpiSummaryGrid.jsx';
import { useReport } from '../ui/useReport.js';

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }));

export function MonthlyPage() {
  const { selectedStore, to } = useSession();
  const vendor = selectedStore?.pos_vendor;
  const store = selectedStore?.store_code;

  // Month and year follow the "To" date until the user picks another month.
  const [month, setMonth] = useState(() => (to ? Number(to.slice(5, 7)) : new Date().getMonth() + 1));
  const [year, setYear] = useState(() => (to ? Number(to.slice(0, 4)) : new Date().getFullYear()));
  useEffect(() => {
    if (!to) return;
    setMonth(Number(to.slice(5, 7)));
    setYear(Number(to.slice(0, 4)));
  }, [to]);

  const { data, loading, error } = useReport(
    (p) => getMonthlyDepartments(p.vendor, { store: p.store, month, year }),
    [month, year]
  );

  const groups = useMemo(() => groupBySalesClass(data?.departments, 'salesClass'), [data]);
  const merchandiseNet = data?.totals?.netSalesTotal;

  const kpis = useMemo(() => {
    if (!data || merchandiseNet === undefined || merchandiseNet === null) return [];
    return [
      {
        title: 'Merchandise Net Sales',
        value: formatCell(merchandiseNet, 'money'),
        subtitle: `${MONTHS[month - 1]} ${year} · Excludes fuel & lottery`,
        badge: 'Monthly Total',
        accent: 'var(--primary)',
      },
      {
        title: 'Reporting Period',
        value: `${MONTHS[month - 1]} ${year}`,
        subtitle: 'Audited monthly close numbers',
        accent: 'var(--info)',
      },
    ];
  }, [data, merchandiseNet, month, year]);

  return (
    <div>
      <div className="filter-bar">
        <div className="control-group">
          <label htmlFor="month-select" className="control-label">Month</label>
          <select id="month-select" className="control-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="year-input" className="control-label">Year</label>
          <input
            id="year-input"
            type="number"
            className="control-input mono"
            style={{ width: '100px' }}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
      </div>

      <ReportStatus loading={loading} error={error} what="monthly report" />
      {!loading && kpis.length > 0 && <KpiSummaryGrid items={kpis} />}
      {!loading && data && (
        <ReportTable
          reportId="monthly"
          title={`Monthly report — ${MONTHS[month - 1]} ${year}`}
          note={
            merchandiseNet !== undefined && merchandiseNet !== null
              ? `Merchandise net sales: ${formatCell(merchandiseNet, 'money')}. Lottery and fuel are shown separately and not included.`
              : 'Lottery and fuel are shown separately and not included in merchandise sales.'
          }
          groups={groups}
          showTotal={false}
          csvUrl={getCsvUrl(vendor, 'departments/monthly', { store, month, year })}
        />
      )}
    </div>
  );
}
export default MonthlyPage;

import React, { useMemo } from 'react';
import { useSession } from '../session/SessionContext.jsx';
import { getDaySummary, getCsvUrl } from '../api/reports.js';
import { ReportTable } from '../ui/ReportTable.jsx';
import { ReportStatus } from '../ui/ReportStatus.jsx';
import { KpiSummaryGrid } from '../ui/KpiSummaryGrid.jsx';
import { useReport } from '../ui/useReport.js';
import { sumCents, sumMilli } from '../num.js';
import { formatCell } from '../format.js';

export function DaySummaryPage() {
  const { selectedStore, from, to } = useSession();
  const vendor = selectedStore?.pos_vendor;
  const store = selectedStore?.store_code;

  const { data, loading, error } = useReport((p) => getDaySummary(p.vendor, { store: p.store, from: p.from, to: p.to }));

  const kpis = useMemo(() => {
    if (!data || data.length === 0) return [];

    const merchTotal = sumCents(data, 'merchandise_net') / 100;
    const fuelSalesTotal = sumCents(data, 'fuel_sales') / 100;
    const fuelGallonsTotal = sumMilli(data, 'fuel_gallons') / 1000;
    const lotSales = sumCents(data, 'lottery_sales') / 100;
    const lotPayouts = sumCents(data, 'lottery_payouts') / 100;
    const lotNet = lotSales - lotPayouts;
    const customersTotal = sumMilli(data, 'customers') / 1000;
    const grandSales = sumCents(data, 'total_sales_with_tax') / 100;

    return [
      {
        title: 'Merchandise Net',
        value: formatCell(merchTotal, 'money'),
        subtitle: 'Excludes fuel & lottery',
        badge: `${data.length} days`,
        accent: 'var(--primary)',
      },
      {
        title: 'Total Fuel Sales',
        value: formatCell(fuelSalesTotal, 'money'),
        subtitle: `${formatCell(fuelGallonsTotal, 'gallons')} gallons dispensed`,
        accent: 'var(--info)',
      },
      {
        title: 'Lottery Net Sales',
        value: formatCell(lotNet, 'money'),
        subtitle: `${formatCell(lotSales, 'money')} sales · ${formatCell(lotPayouts, 'money')} paid`,
        accent: 'var(--success)',
      },
      {
        title: 'Customer Traffic',
        value: formatCell(customersTotal, 'count'),
        subtitle: `Total sales w/ tax: ${formatCell(grandSales, 'money')}`,
        accent: 'var(--warning)',
      },
    ];
  }, [data]);

  return (
    <div>
      <ReportStatus loading={loading} error={error} what="day summary" />
      {!loading && data && data.length > 0 && <KpiSummaryGrid items={kpis} />}
      {!loading && data && (
        <ReportTable
          reportId="daySummary"
          title="Day summary"
          note={
            'Merchandise sales do not include lottery or fuel. ' +
            `Transaction void amount is ${vendor === 'GILBARCO' ? 'with' : 'before'} tax. ` +
            'Refund amount = value of refunded items.' +
            (vendor === 'VERIFONE' ? ' Refunded money = cash handed back.' : '')
          }
          rows={data}
          csvUrl={getCsvUrl(vendor, 'day-summary', { store, from, to })}
        />
      )}
    </div>
  );
}
export default DaySummaryPage;

import React, { useMemo } from 'react';
import { useSession } from '../session/SessionContext.jsx';
import { getLottery, getDepartments, getCsvUrl } from '../api/reports.js';
import { ReportTable } from '../ui/ReportTable.jsx';
import { ReportStatus } from '../ui/ReportStatus.jsx';
import { useReport } from '../ui/useReport.js';

const LOTTERY_CLASSES = ['lottery_sale', 'lottery_payout'];

/**
 * One section per lottery department, sales departments before payout departments.
 * The split exists only where the POS has separate departments (Wolf: scratch off / online);
 * a store with a single "Lotto" department gets a single sales section.
 */
export function groupByLotteryDepartment(rows) {
  const byDept = new Map();
  for (const row of rows || []) {
    if (!LOTTERY_CLASSES.includes(row.sales_class)) continue;
    const id = `${row.sales_class}:${row.dept_number}`;
    if (!byDept.has(id)) {
      byDept.set(id, {
        id,
        cls: row.sales_class,
        label: row.dept_name ? `${row.dept_name} (#${row.dept_number})` : `Department #${row.dept_number}`,
        rows: [],
      });
    }
    byDept.get(id).rows.push(row);
  }
  return [...byDept.values()]
    .sort((a, b) => LOTTERY_CLASSES.indexOf(a.cls) - LOTTERY_CLASSES.indexOf(b.cls) || a.label.localeCompare(b.label))
    .map((g) => ({ ...g, rows: g.rows.sort((a, b) => a.business_date.localeCompare(b.business_date)) }));
}

export function LotteryPage() {
  const { selectedStore, from, to } = useSession();
  const vendor = selectedStore?.pos_vendor;
  const store = selectedStore?.store_code;

  const daily = useReport((p) => getLottery(p.vendor, { store: p.store, from: p.from, to: p.to }));
  const depts = useReport((p) => getDepartments(p.vendor, { store: p.store, from: p.from, to: p.to, byDay: true }));

  const groups = useMemo(() => groupByLotteryDepartment(depts.data), [depts.data]);
  const loading = daily.loading || depts.loading;

  return (
    <div>
      <ReportStatus loading={loading} error={daily.error || depts.error} what="lottery" />

      {!loading && depts.data && (
        <ReportTable
          reportId="lotteryDepartments"
          title="Lottery by game"
          note="One section per lottery department on the register (for example scratch-off and online). Payouts are negative. Open a section to see each day."
          groups={groups}
          showTotal={false}
          startCollapsed
          emptyMessage="No lottery sales for these dates."
        />
      )}

      {!loading && daily.data && (
        <ReportTable
          reportId="lottery"
          title="Lottery by day"
          note="All lottery games together. Lottery is kept separate from merchandise sales; payouts are shown as positive amounts."
          rows={daily.data}
          csvUrl={getCsvUrl(vendor, 'lottery', { store, from, to })}
        />
      )}
    </div>
  );
}
export default LotteryPage;

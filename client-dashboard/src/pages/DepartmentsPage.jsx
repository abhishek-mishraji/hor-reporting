import React, { useMemo, useState } from 'react';
import { useSession } from '../session/SessionContext.jsx';
import { getDepartments, getCsvUrl } from '../api/reports.js';
import { groupBySalesClass } from '../reportColumns.js';
import { ReportTable } from '../ui/ReportTable.jsx';
import { ReportStatus } from '../ui/ReportStatus.jsx';
import { useReport } from '../ui/useReport.js';

export function DepartmentsPage() {
  const { selectedStore, from, to } = useSession();
  const vendor = selectedStore?.pos_vendor;
  const store = selectedStore?.store_code;
  const [byDay, setByDay] = useState(false);

  const { data, loading, error } = useReport(
    (p) => getDepartments(p.vendor, { store: p.store, from: p.from, to: p.to, byDay: byDay || undefined }),
    [byDay]
  );

  const groups = useMemo(() => groupBySalesClass(data, 'sales_class'), [data]);

  return (
    <div>
      <div className="filter-bar">
        <label className="filter-check">
          <input type="checkbox" checked={byDay} onChange={(e) => setByDay(e.target.checked)} />
          <span>Show each day</span>
        </label>
      </div>

      <ReportStatus loading={loading} error={error} what="departments" />
      {!loading && data && (
        <ReportTable
          reportId="departments"
          title="Department sales"
          note="Lottery and fuel are shown in their own sections and are not part of merchandise sales."
          groups={groups}
          showTotal={false}
          csvUrl={getCsvUrl(vendor, 'departments', { store, from, to, byDay: byDay || undefined })}
        />
      )}
    </div>
  );
}
export default DepartmentsPage;

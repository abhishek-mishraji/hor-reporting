import React, { useState } from 'react';
import { useSession } from '../session/SessionContext.jsx';
import { getFuel, getCsvUrl } from '../api/reports.js';
import { ReportTable } from '../ui/ReportTable.jsx';
import { ReportStatus } from '../ui/ReportStatus.jsx';
import { useReport } from '../ui/useReport.js';

export function FuelPage() {
  const { selectedStore, from, to } = useSession();
  const vendor = selectedStore?.pos_vendor;
  const store = selectedStore?.store_code;
  const [byDay, setByDay] = useState(false);
  const [byPriceLevel, setByPriceLevel] = useState(false);

  const params = { byDay: byDay || undefined, byPriceLevel: byPriceLevel || undefined };
  const { data, loading, error } = useReport(
    (p) => getFuel(p.vendor, { store: p.store, from: p.from, to: p.to, ...params }),
    [byDay, byPriceLevel]
  );

  return (
    <div>
      <div className="filter-bar">
        <label className="filter-check">
          <input type="checkbox" checked={byDay} onChange={(e) => setByDay(e.target.checked)} />
          <span>Show each day</span>
        </label>
        <label className="filter-check">
          <input type="checkbox" checked={byPriceLevel} onChange={(e) => setByPriceLevel(e.target.checked)} />
          <span>Split by price level</span>
        </label>
      </div>

      <ReportStatus loading={loading} error={error} what="fuel" />
      {!loading && data && (
        <ReportTable
          reportId="fuel"
          title="Fuel sales"
          note="Gallon volumes and fuel revenue across all dispenser positions."
          rows={data}
          csvUrl={getCsvUrl(vendor, 'fuel', { store, from, to, ...params })}
        />
      )}
    </div>
  );
}
export default FuelPage;

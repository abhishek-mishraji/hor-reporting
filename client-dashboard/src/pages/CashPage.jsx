import React, { useState } from 'react';
import { useSession } from '../session/SessionContext.jsx';
import { getCashMovements, getCsvUrl } from '../api/reports.js';
import { ReportTable } from '../ui/ReportTable.jsx';
import { ReportStatus } from '../ui/ReportStatus.jsx';
import { DrilldownModal } from '../ui/DrilldownModal.jsx';
import { useReport } from '../ui/useReport.js';

export function CashPage() {
  const { selectedStore, from, to } = useSession();
  const vendor = selectedStore?.pos_vendor;
  const store = selectedStore?.store_code;
  const isG = vendor === 'GILBARCO';
  const [kind, setKind] = useState('');
  const [drilldown, setDrilldown] = useState(null);

  const { data, loading, error } = useReport(
    (p) => getCashMovements(p.vendor, { store: p.store, from: p.from, to: p.to, kind: kind || undefined }),
    [kind]
  );

  return (
    <div>
      <div className="filter-bar">
        <div className="control-group">
          <label htmlFor="cash-kind" className="control-label">Movement Type</label>
          <select id="cash-kind" className="control-select" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All movement types</option>
            <option value="safe_drop">Safe drop</option>
            <option value="payout">Paid-out</option>
            <option value="safe_loan">Safe loan</option>
            {isG && <option value="pay_in">Pay-in</option>}
          </select>
        </div>
      </div>

      <ReportStatus loading={loading} error={error} what="cash movements" />
      {!loading && data && (
        <ReportTable
          reportId="cash"
          title="Cash movements"
          note="Click any movement row to inspect the register transaction."
          rows={data}
          onRowClick={(row) => setDrilldown({ fileId: row.file_id, ticketSeq: row.ticket_seq })}
          csvUrl={getCsvUrl(vendor, 'cash-movements', { store, from, to, kind: kind || undefined })}
        />
      )}

      {drilldown && (
        <DrilldownModal
          isOpen
          onClose={() => setDrilldown(null)}
          fileId={drilldown.fileId}
          ticketSeq={drilldown.ticketSeq}
          vendor={vendor}
          storeCode={store}
        />
      )}
    </div>
  );
}
export default CashPage;

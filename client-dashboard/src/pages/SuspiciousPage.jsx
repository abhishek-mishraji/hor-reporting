import React, { useMemo, useRef, useState } from 'react';
import { useSession } from '../session/SessionContext.jsx';
import { getSuspiciousDaily, getVoids, getSuspiciousEvents, getCsvUrl } from '../api/reports.js';
import { ReportTable } from '../ui/ReportTable.jsx';
import { ReportStatus } from '../ui/ReportStatus.jsx';
import { DrilldownModal } from '../ui/DrilldownModal.jsx';
import { useReport, useDebounced } from '../ui/useReport.js';
import { voidItemRows, filterVoidItems, summarizeVoidItems } from '../voidItems.js';
import { formatCell } from '../format.js';

const EVENT_LIMIT = 20000;

export function SuspiciousPage() {
  const { selectedStore, from, to } = useSession();
  const vendor = selectedStore?.pos_vendor;
  const store = selectedStore?.store_code;
  const isV = vendor === 'VERIFONE';
  const isG = vendor === 'GILBARCO';

  const [kind, setKind] = useState('');
  const [registerInput, setRegisterInput] = useState('');
  const register = useDebounced(registerInput.trim());
  const [drilldown, setDrilldown] = useState(null);
  const [voidType, setVoidType] = useState('');
  // a day picked in "Voids by day"; it only applies to the store and dates it was picked in
  const [voidPick, setVoidPick] = useState(null);
  const rangeKey = `${store}|${from}|${to}`;
  const voidDate = voidPick?.rangeKey === rangeKey ? voidPick.date : '';
  const setVoidDate = (date) => setVoidPick(date ? { date, rangeKey } : null);
  const voidSectionRef = useRef(null);

  const daily = useReport((p) => getSuspiciousDaily(p.vendor, { store: p.store, from: p.from, to: p.to }));
  const voids = useReport((p) => getVoids(p.vendor, { store: p.store, from: p.from, to: p.to }));

  const eventParams = { limit: EVENT_LIMIT, kind: kind || undefined, register: register || undefined };
  const events = useReport(
    (p) => getSuspiciousEvents(p.vendor, { store: p.store, from: p.from, to: p.to, ...eventParams }),
    [kind, register]
  );

  // Voided items: every void event in range, independent of the Event Type / Register filters below.
  const voidEvents = useReport((p) =>
    getSuspiciousEvents(p.vendor, { store: p.store, from: p.from, to: p.to, limit: EVENT_LIMIT })
  );
  const voidRows = useMemo(() => voidItemRows(voidEvents.data, vendor), [voidEvents.data, vendor]);
  const shownVoids = useMemo(
    () => filterVoidItems(voidRows, { type: voidType, date: voidDate }),
    [voidRows, voidType, voidDate]
  );
  const voidSummary = summarizeVoidItems(shownVoids);

  const showVoidsOn = (row) => {
    setVoidDate(row.business_date);
    voidSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const range = { store, from, to };
  const loading = daily.loading || voids.loading;

  return (
    <div>
      <ReportStatus loading={loading} error={daily.error || voids.error} what="suspicious activity" />
      {!loading && daily.data && (
        <ReportTable
          reportId="suspiciousDaily"
          title="Suspicious activity by day"
          note="Daily summary of audit events, cash drawer openings, and exceptions."
          rows={daily.data}
          csvUrl={getCsvUrl(vendor, 'suspicious/daily', range)}
        />
      )}
      {!loading && voids.data && (
        <ReportTable
          reportId="voids"
          title="Voids by day"
          note="Daily totals for transaction voids, item voids, and return refunds."
          rows={voids.data}
          csvUrl={getCsvUrl(vendor, 'voids', range)}
          onRowClick={showVoidsOn}
          isRowClickable={(row) => Boolean(row.business_date)}
          rowTitle="Click to list the voided items of this day"
        />
      )}

      <div ref={voidSectionRef}>
        <div className="filter-bar">
          <div className="control-group">
            <label htmlFor="void-type" className="control-label">Void Type</label>
            <select id="void-type" className="control-select" value={voidType} onChange={(e) => setVoidType(e.target.value)}>
              <option value="">All</option>
              <option value="line">Line voids</option>
              <option value="transaction">Transaction voids</option>
            </select>
          </div>
          {voidDate && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              title="Show every date again"
              onClick={() => setVoidDate('')}
            >
              {formatCell(voidDate, 'date')} ✕
            </button>
          )}
          {voidRows.length > 0 && (
            <span className="table-note mono">
              {voidSummary.lineCount} line voids · {formatCell(voidSummary.lineCents / 100, 'money')} |{' '}
              {voidSummary.voidCount} transaction voids · {formatCell(voidSummary.voidCents / 100, 'money')}
            </span>
          )}
        </div>

        <ReportStatus loading={voidEvents.loading} error={voidEvents.error} what="voided items" />
        {!voidEvents.loading && voidEvents.data && (
          <ReportTable
            reportId="voidItems"
            title="Voided items"
            note={
              voidEvents.data.length >= EVENT_LIMIT
                ? `Showing the first ${EVENT_LIMIT.toLocaleString()} events. Pick fewer dates to see the rest.`
                : `${isG ? 'Each row is one transaction with voided items.' : 'Each row is one voided line.'} ` +
                  `Transaction void amounts are ${isG ? 'with' : 'before'} tax. Click a row to see the full receipt.`
            }
            rows={shownVoids}
            onRowClick={(row) => setDrilldown({ fileId: row.file_id, ticketSeq: row.ticket_seq })}
            csvFileName={`voided-items_${store}_${from}_${to}.csv`}
          />
        )}
      </div>

      <div className="filter-bar">
        <div className="control-group">
          <label htmlFor="suspicious-kind" className="control-label">Event Type</label>
          <select id="suspicious-kind" className="control-select" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All types</option>
            <option value="no_sale">No sale</option>
            <option value="void_line">Line void</option>
            <option value="void">Transaction void</option>
            <option value="refund">Refund</option>
            {isV && <option value="refund_void">Refund void</option>}
            {isG && <option value="void_line_in_prepay_deposit">Line void (prepay)</option>}
            {isG && <option value="void_line_in_voided_transaction">Line void (in voided sale)</option>}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="suspicious-register" className="control-label">Register #</label>
          <input
            id="suspicious-register"
            type="text"
            className="control-input mono"
            placeholder="All"
            style={{ width: '100px' }}
            value={registerInput}
            onChange={(e) => setRegisterInput(e.target.value)}
          />
        </div>
      </div>

      <ReportStatus loading={events.loading} error={events.error} what="events" />
      {!events.loading && events.data && (
        <ReportTable
          reportId="suspiciousEvents"
          title="Every audit event"
          note={
            events.data.length >= EVENT_LIMIT
              ? `Showing the first ${EVENT_LIMIT.toLocaleString()} events. Pick a type, register or fewer dates to see the rest.`
              : 'Click any event row to inspect the full transaction receipt.'
          }
          rows={events.data}
          onRowClick={(row) => setDrilldown({ fileId: row.file_id, ticketSeq: row.ticket_seq })}
          csvUrl={getCsvUrl(vendor, 'suspicious/events', { ...range, ...eventParams })}
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
export default SuspiciousPage;

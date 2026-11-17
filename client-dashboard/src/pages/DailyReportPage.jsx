import React, { useEffect, useMemo } from 'react';
import { useSession } from '../session/SessionContext.jsx';
import { getDepartments, getFuel } from '../api/reports.js';
import { ReportStatus } from '../ui/ReportStatus.jsx';
import { useReport } from '../ui/useReport.js';
import { CalendarIcon } from '../ui/Icons.jsx';
import { formatCell } from '../format.js';
import { sumCents, fromCents, sumMilli, fromMilli } from '../num.js';

/**
 * Merchandise departments of one day, in register order (department number).
 * Lottery and fuel are left out by the server (salesClass=merchandise).
 */
export function merchandiseRows(rows) {
  return (rows || [])
    .filter((r) => r.sales_class === 'merchandise')
    .map((r) => ({
      key: r.dept_number,
      name: r.dept_name || `Department #${r.dept_number}`,
      amount: r.net_sales,
    }))
    .sort((a, b) => Number(a.key) - Number(b.key));
}

/** "REGULAR" -> "Regular"; names already in mixed case are kept as the POS wrote them. */
export function gradeLabel(name) {
  const s = String(name ?? '').trim();
  if (!s) return 'Unknown grade';
  return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}

/**
 * Pumped fuel of one day, one row per grade the POS reported (every grade is shown,
 * even one with nothing pumped). `amount` is gross dollars, before fuel discounts.
 */
export function fuelRows(rows) {
  return (rows || []).map((r) => ({
    key: r.fuel_grade_id ?? r.fuel_grade,
    grade: gradeLabel(r.fuel_grade),
    gallons: r.gallons,
    amount: r.amount,
  }));
}

/** A label | symbol | value block, with a total row, like the store's paper daily report. */
function SummaryBlock({ title, note, symbol, rows, type, totalLabel, total, emptyMessage }) {
  return (
    <div className="table-card daily-report">
      <div className="table-header-title">
        <div>
          <h3>{title}</h3>
          {note && <div className="table-note">{note}</div>}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">{emptyMessage}</div>
        </div>
      ) : (
        <table className="daily-report__table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                <td className="daily-report__symbol">{symbol}</td>
                <td className="mono">{formatCell(r.value, type)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{totalLabel}</th>
              <td className="daily-report__symbol">{symbol}</td>
              <td className="mono">{formatCell(total, type)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

export function DailyReportPage() {
  const { selectedStore, from, to, setFrom, setTo } = useSession();
  const day = to;

  // This report covers one day: collapse a date range to its last day.
  useEffect(() => {
    if (day && from !== day) setFrom(day);
  }, [day, from, setFrom]);

  const pickDay = (d) => {
    if (!d) return;
    setFrom(d);
    setTo(d);
  };

  const depts = useReport((p) =>
    getDepartments(p.vendor, { store: p.store, from: p.to, to: p.to, salesClass: 'merchandise' })
  );
  const fuel = useReport((p) => getFuel(p.vendor, { store: p.store, from: p.to, to: p.to }));

  const merch = useMemo(() => merchandiseRows(depts.data), [depts.data]);
  const grades = useMemo(() => fuelRows(fuel.data), [fuel.data]);

  const loading = depts.loading || fuel.loading;
  const dayLabel = formatCell(day, 'date');

  return (
    <div>
      <div className="filter-bar">
        <div className="control-group" title="Business day">
          <CalendarIcon size={14} />
          <label htmlFor="daily-report-day" className="control-label">Day</label>
          <input
            id="daily-report-day"
            type="date"
            className="control-input mono"
            value={day || ''}
            min={selectedStore?.first_day || undefined}
            max={selectedStore?.last_day || undefined}
            onChange={(e) => pickDay(e.target.value)}
          />
        </div>
      </div>

      <ReportStatus loading={loading} error={depts.error || fuel.error} what="daily report" />

      {!loading && (
        <div className="daily-report__grid">
          {depts.data && (
            <SummaryBlock
              title="Merchandise Sales"
              note={`${dayLabel} · net sales by department. Lottery and fuel are not included.`}
              symbol="$"
              type="money"
              rows={merch.map((r) => ({ key: r.key, label: r.name, value: r.amount }))}
              totalLabel="Total Grocery"
              total={fromCents(sumCents(merch, 'amount'))}
              emptyMessage="No merchandise sales for this day."
            />
          )}

          {fuel.data && (
            <div>
              <SummaryBlock
                title="Fuel Sold (Gallons)"
                note={`${dayLabel} · gallons pumped by grade.`}
                symbol="#"
                type="gallons"
                rows={grades.map((g) => ({ key: g.key, label: `${g.grade} Volume`, value: g.gallons }))}
                totalLabel="Total Gas Volume"
                total={fromMilli(sumMilli(grades, 'gallons'))}
                emptyMessage="No fuel pumped this day."
              />
              <SummaryBlock
                title="Fuel Sold (Amount)"
                note={`${dayLabel} · pump dollars by grade, before fuel discounts.`}
                symbol="$"
                type="money"
                rows={grades.map((g) => ({ key: g.key, label: `${g.grade} Amt Sold`, value: g.amount }))}
                totalLabel="Total Gas Amt Sold"
                total={fromCents(sumCents(grades, 'amount'))}
                emptyMessage="No fuel sold this day."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default DailyReportPage;

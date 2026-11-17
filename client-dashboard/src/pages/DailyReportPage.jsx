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

const LOTTERY_CLASSES = new Set(['lottery_sale', 'lottery_payout']);

function lotteryKind(name) {
  const n = String(name ?? '').toLowerCase();
  if (n.includes('online')) return 'online';
  if (n.includes('scratch') || n.includes('instant')) return 'scratch';
  return null;
}

/**
 * Lottery figures of one day from the lottery departments.
 * - Sales are split into scratch-off / online only when every lottery sales department is named as one
 *   of them (Gilbarco 800: 5 LOTTO SCRATCH OFF, 57 LOTTO ONLINE). Otherwise one combined "Lottery sales"
 *   (Verifone 8730: one "Lotto" department).
 * - Cashes = all winnings paid at the register (payout departments, made positive); the POS can't split
 *   them, so they are shown as scratch-off cashes and online cashes stay 0.
 * - Balance = sales part (online sales; combined sales when not split) − cashes. The other reading rows
 *   (settlement, adjustment, credits, commission) are not in the POS and are 0.
 * Amounts are strings with 2 decimals; tickets are units sold (null when there is no department).
 */
export function lotteryReport(rows) {
  const lottery = (rows || []).filter((r) => LOTTERY_CLASSES.has(r.sales_class));
  const sales = lottery.filter((r) => r.sales_class === 'lottery_sale');
  const payouts = lottery.filter((r) => r.sales_class === 'lottery_payout');

  const part = (list) =>
    list.length === 0
      ? { amount: '0.00', cents: 0, tickets: null }
      : {
          amount: fromCents(sumCents(list, 'net_sales')),
          cents: sumCents(list, 'net_sales'),
          tickets: Math.abs(list.reduce((n, r) => n + Number(r.units_sold || 0), 0)),
        };

  const split = sales.length > 0 && sales.every((r) => lotteryKind(r.dept_name));
  const scratch = part(split ? sales.filter((r) => lotteryKind(r.dept_name) === 'scratch') : []);
  const online = part(split ? sales.filter((r) => lotteryKind(r.dept_name) === 'online') : []);
  const combined = part(split ? [] : sales);

  const paid = part(payouts);
  const cashes = { ...paid, cents: -paid.cents, amount: fromCents(-paid.cents) };

  const balanceCents = (split ? online.cents : combined.cents) - cashes.cents;
  return { split, scratch, online, combined, cashes, balance: fromCents(balanceCents) };
}

/**
 * A label | sign | value [| tickets] block, like the store's paper daily report.
 * Each row may carry its own `symbol` (e.g. "+ $", "− $") and a `count`; the total row is optional.
 */
function SummaryBlock({ title, note, symbol, rows, type, totalLabel, total, emptyMessage, countLabel }) {
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
                <td className={`daily-report__symbol daily-report__symbol--${r.tone || 'plain'}`}>
                  {r.symbol ?? symbol}
                </td>
                <td className="mono">{formatCell(r.value, type)}</td>
                {countLabel && (
                  <td className="daily-report__count">
                    {r.count != null && `${formatCell(r.count, 'count')} ${countLabel}`}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {totalLabel && (
            <tfoot>
              <tr>
                <th scope="row">{totalLabel}</th>
                <td className="daily-report__symbol">{symbol}</td>
                <td className="mono">{formatCell(total, type)}</td>
                {countLabel && <td className="daily-report__count" />}
              </tr>
            </tfoot>
          )}
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

  // All departments of the day: merchandise and lottery are both taken from this one answer.
  const depts = useReport((p) => getDepartments(p.vendor, { store: p.store, from: p.to, to: p.to }));
  const fuel = useReport((p) => getFuel(p.vendor, { store: p.store, from: p.to, to: p.to }));

  const merch = useMemo(() => merchandiseRows(depts.data), [depts.data]);
  const grades = useMemo(() => fuelRows(fuel.data), [fuel.data]);
  const lotto = useMemo(() => lotteryReport(depts.data), [depts.data]);

  const ZERO = '0.00';
  const ticketsSoldRows = lotto.split
    ? [{ key: 'scratch', label: 'Scratch-off sales', symbol: '+ $', tone: 'plus', value: lotto.scratch.amount, count: lotto.scratch.tickets }]
    : [{ key: 'sales', label: 'Lottery sales', symbol: '+ $', tone: 'plus', value: lotto.combined.amount, count: lotto.combined.tickets }];
  const readingRows = [
    ...(lotto.split
      ? [{ key: 'online', label: 'Net online sales', symbol: '+ $', tone: 'plus', value: lotto.online.amount, count: lotto.online.tickets }]
      : []),
    { key: 'onlineCashes', label: 'Net online cashes', symbol: '− $', tone: 'minus', value: ZERO },
    { key: 'scratchCashes', label: 'Scratch-off cashes', symbol: '− $', tone: 'minus', value: lotto.cashes.amount, count: lotto.cashes.tickets },
    { key: 'settlement', label: 'Settlement', symbol: '$', value: ZERO },
    { key: 'adjustment', label: 'Adjustment', symbol: '− $', tone: 'minus', value: ZERO },
    { key: 'onlineCredit', label: 'Online credit', symbol: '− $', tone: 'minus', value: ZERO },
    { key: 'scratchCredit', label: 'Scratch-off credit', symbol: '− $', tone: 'minus', value: ZERO },
    { key: 'commission', label: 'Commission', symbol: '$', value: ZERO },
  ];

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

      {!loading && (depts.data || fuel.data) && (
        <section className="daily-report__section" aria-labelledby="daily-report-money-in">
          <h2 id="daily-report-money-in" className="daily-report__section-title">Money In</h2>
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

          {depts.data && (
            <div>
              <SummaryBlock
                title="Lottery Tickets Sold"
                note={
                  lotto.split
                    ? `${dayLabel} · scratch-off tickets sold at the register.`
                    : `${dayLabel} · all lottery sold at the register. This register does not separate scratch-off and online.`
                }
                symbol="$"
                type="money"
                countLabel="tickets"
                rows={ticketsSoldRows}
              />
              <SummaryBlock
                title="Lottery/Lotto Reading"
                note="Cashes are all lottery winnings paid at the register (the register does not split online and scratch-off). Settlement, adjustment, credits and commission are not recorded by the register and show 0.00."
                symbol="$"
                type="money"
                countLabel="tickets"
                rows={readingRows}
                totalLabel="Balance"
                total={lotto.balance}
              />
            </div>
          )}
        </div>
        </section>
      )}
    </div>
  );
}
export default DailyReportPage;

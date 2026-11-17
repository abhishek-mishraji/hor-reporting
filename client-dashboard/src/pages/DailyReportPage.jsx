import React, { useEffect, useMemo } from 'react';
import { useSession } from '../session/SessionContext.jsx';
import { getDepartments, getFuel, getPayments, getCashMovements, getDaySummary } from '../api/reports.js';
import { ReportStatus } from '../ui/ReportStatus.jsx';
import { useReport } from '../ui/useReport.js';
import { CalendarIcon } from '../ui/Icons.jsx';
import { formatCell } from '../format.js';
import { sumCents, fromCents, sumMilli, fromMilli, toCents } from '../num.js';

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
  const cashes = {
    ...paid,
    cents: -paid.cents,
    amount: fromCents(-paid.cents),
  };

  const balanceCents = (split ? online.cents : combined.cents) - cashes.cents;
  return {
    split,
    scratch,
    online,
    combined,
    cashes,
    balance: fromCents(balanceCents),
  };
}

/** Which Money Out bucket a POS payment type belongs to (null = not shown, e.g. cash). */
export function paymentBucket(row) {
  const name = String(row?.payment_type ?? '').toLowerCase();
  const code = String(row?.tender_code ?? '').toLowerCase();
  if (name.includes('ebt') || code === 'ebt') return 'ebt';
  if (name === 'house' || code === 'house') return 'house';
  if (name.includes('credit') || name.includes('debit') || name === 'mobile') return 'card';
  return null;
}

/**
 * Money Out figures of one day from the POS, as positive amounts (strings, 2 decimals).
 * - deposits: safe drops. card: Credit + Debit (+ pump Crind Credit/Debit, + Mobile).
 * - ebt: EBT payments. house: house-charge payments (customer account sales).
 * - paidOuts: store paid-outs (shown as cash purchases). payIns: pay-ins (shown as other income).
 * Everything the POS does not have is 0 on the page.
 */
export function moneyOut(payments, movements) {
  const pays = payments || [];
  const moves = movements || [];
  const payTotal = (bucket) =>
    fromCents(
      sumCents(
        pays.filter((p) => paymentBucket(p) === bucket),
        'net_amount',
      ),
    );
  const moveTotal = (kind) =>
    fromCents(
      sumCents(
        moves.filter((m) => m.kind === kind),
        'amount',
      ),
    );
  return {
    deposits: moveTotal('safe_drop'),
    card: payTotal('card'),
    ebt: payTotal('ebt'),
    house: payTotal('house'),
    paidOuts: moveTotal('payout'),
    payIns: moveTotal('pay_in'),
  };
}

/**
 * Footer totals of one day (strings, 2 decimals).
 * - Money In  = Total Grocery + Total Gas Amt Sold + lottery sales + sales tax.
 * - Money Out = following the signs of the paper report: every "− $" row added, every "+ $" row subtracted:
 *   deposits + card batch + EBT + cash purchases (paid-outs) + customer account sales (house)
 *   + lottery cashes (winnings paid, shown in the lottery reading) − other income
 *   (pay-ins). Rows the POS does not have are 0 and change nothing.
 */
export function dailyTotals({ merch, grades, lotto, tax, out }) {
  const lottoSales = lotto.split ? lotto.scratch.cents + lotto.online.cents : lotto.combined.cents;
  const moneyIn =
    sumCents(merch, 'amount') + sumCents(grades, 'amount') + lottoSales + toCents(tax);
  const c = (k) => toCents(out[k]);
  const moneyOut = c('deposits') + c('card') + c('ebt') + c('paidOuts') + c('house') + lotto.cashes.cents - c('payIns');
  // Over/Short = Total Money Out − Total Money In (negative = short, positive = over).
  return { moneyIn: fromCents(moneyIn), moneyOut: fromCents(moneyOut), overShort: fromCents(moneyOut - moneyIn) };
}

/** Colour of the Over/Short figure: red when short (negative), green when over (positive). */
export function overShortTone(value) {
  const n = Number(value);
  if (n < 0) return 'out';
  if (n > 0) return 'in';
  return 'zero';
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
                <td className="mono">{formatCell(r.value, r.type || type)}</td>
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

  const payments = useReport((p) => getPayments(p.vendor, { store: p.store, from: p.to, to: p.to }));
  const moves = useReport((p) => getCashMovements(p.vendor, { store: p.store, from: p.to, to: p.to }));
  const out = useMemo(() => moneyOut(payments.data, moves.data), [payments.data, moves.data]);

  const ZERO = '0.00';
  const ticketsSoldRows = lotto.split
    ? [
        {
          key: 'scratch',
          label: 'Scratch-off sales',
          symbol: '+ $',
          tone: 'plus',
          value: lotto.scratch.amount,
          count: lotto.scratch.tickets,
        },
      ]
    : [
        {
          key: 'sales',
          label: 'Lottery sales',
          symbol: '+ $',
          tone: 'plus',
          value: lotto.combined.amount,
          count: lotto.combined.tickets,
        },
      ];
  const readingRows = [
    ...(lotto.split
      ? [
          {
            key: 'online',
            label: 'Net online sales',
            symbol: '+ $',
            tone: 'plus',
            value: lotto.online.amount,
            count: lotto.online.tickets,
          },
        ]
      : []),
    {
      key: 'onlineCashes',
      label: 'Net online cashes',
      symbol: '− $',
      tone: 'minus',
      value: ZERO,
    },
    {
      key: 'scratchCashes',
      label: 'Scratch-off cashes',
      symbol: '− $',
      tone: 'minus',
      value: lotto.cashes.amount,
      count: lotto.cashes.tickets,
    },
    { key: 'settlement', label: 'Settlement', symbol: '$', value: ZERO },
    {
      key: 'adjustment',
      label: 'Adjustment',
      symbol: '− $',
      tone: 'minus',
      value: ZERO,
    },
    {
      key: 'onlineCredit',
      label: 'Online credit',
      symbol: '− $',
      tone: 'minus',
      value: ZERO,
    },
    {
      key: 'scratchCredit',
      label: 'Scratch-off credit',
      symbol: '− $',
      tone: 'minus',
      value: ZERO,
    },
    { key: 'commission', label: 'Commission', symbol: '$', value: ZERO },
  ];

  const summary = useReport((p) => getDaySummary(p.vendor, { store: p.store, from: p.to, to: p.to }));
  const tax = summary.data?.[0]?.tax ?? null;
  const totals = useMemo(() => dailyTotals({ merch, grades, lotto, tax, out }), [merch, grades, lotto, tax, out]);

  const loading = depts.loading || fuel.loading || payments.loading || moves.loading || summary.loading;
  const loadError = depts.error || fuel.error || payments.error || moves.error || summary.error;
  const dayLabel = formatCell(day, 'date');

  return (
    <div>
      <div className="filter-bar">
        <div className="control-group" title="Business day">
          <CalendarIcon size={14} />
          <label htmlFor="daily-report-day" className="control-label">
            Day
          </label>
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

      <ReportStatus loading={loading} error={loadError} what="daily report" />

      {!loading && (
        <div className="daily-report__columns">
          {(depts.data || fuel.data) && (
            <section className="daily-report__section" aria-labelledby="daily-report-money-in">
              <h2 id="daily-report-money-in" className="daily-report__section-title">
                Money In
              </h2>
              <div className="daily-report__grid">
                {depts.data && (
                  <SummaryBlock
                    title="Merchandise Sales"
                    note={`${dayLabel} · net sales by department. Lottery and fuel are not included.`}
                    symbol="$"
                    type="money"
                    rows={merch.map((r) => ({
                      key: r.key,
                      label: r.name,
                      value: r.amount,
                    }))}
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
                      rows={grades.map((g) => ({
                        key: g.key,
                        label: `${g.grade} Volume`,
                        value: g.gallons,
                      }))}
                      totalLabel="Total Gas Volume"
                      total={fromMilli(sumMilli(grades, 'gallons'))}
                      emptyMessage="No fuel pumped this day."
                    />
                    <SummaryBlock
                      title="Fuel Sold (Amount)"
                      note={`${dayLabel} · pump dollars by grade, before fuel discounts.`}
                      symbol="$"
                      type="money"
                      rows={grades.map((g) => ({
                        key: g.key,
                        label: `${g.grade} Amt Sold`,
                        value: g.amount,
                      }))}
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

                {summary.data && (
                  <SummaryBlock
                    title="Sales Tax"
                    note={`${dayLabel} · tax collected at the register.`}
                    symbol="+ $"
                    type="money"
                    rows={[{ key: 'tax', label: 'Sales tax collected', tone: 'plus', value: tax ?? ZERO }]}
                  />
                )}
              </div>
            </section>
          )}

          {payments.data && moves.data && (
            <section className="daily-report__section" aria-labelledby="daily-report-money-out">
              <h2 id="daily-report-money-out" className="daily-report__section-title">
                Money Out
              </h2>
              <div className="daily-report__grid">
                <div>
                  <SummaryBlock
                    title="Safe Deposits"
                    note={`${dayLabel} · safe drops, and all card payments (credit, debit, pump, mobile).`}
                    symbol="− $"
                    type="money"
                    rows={[
                      {
                        key: 'deposits',
                        label: 'Total deposits',
                        tone: 'minus',
                        value: out.deposits,
                      },
                      {
                        key: 'card',
                        label: 'Credit card batch',
                        tone: 'minus',
                        value: out.card,
                      },
                    ]}
                  />
                  <SummaryBlock
                    title="Credit Card 2 (Credited in Bank)"
                    symbol="− $"
                    type="money"
                    rows={[
                      {
                        key: 'generic1',
                        label: 'Sales by generic card 1',
                        tone: 'minus',
                        value: ZERO,
                      },
                      {
                        key: 'generic2',
                        label: 'Sales by generic card 2',
                        tone: 'minus',
                        value: ZERO,
                      },
                    ]}
                  />
                  <SummaryBlock
                    title="Bank Deposits"
                    symbol="− $"
                    type="money"
                    rows={[
                      {
                        key: 'ebt',
                        label: 'EBT/Foodstamp',
                        tone: 'minus',
                        value: out.ebt,
                      },
                    ]}
                  />
                </div>

                <div>
                  <SummaryBlock
                    title="Cash Purchases"
                    note="Cash purchases = store paid-outs. Other income = pay-ins. Customer account sales = house charges."
                    symbol="− $"
                    type="money"
                    rows={[
                      {
                        key: 'purchases',
                        label: 'Cash Purchases',
                        tone: 'minus',
                        value: out.paidOuts,
                      },
                      {
                        key: 'expenses',
                        label: 'Cash Expenses',
                        tone: 'minus',
                        value: ZERO,
                      },
                      {
                        key: 'generalPaid',
                        label: 'General Account paid',
                        tone: 'minus',
                        value: ZERO,
                      },
                      {
                        key: 'otherIncome',
                        label: 'Other Income',
                        symbol: '+ $',
                        tone: 'plus',
                        value: out.payIns,
                      },
                      {
                        key: 'custSales',
                        label: 'Cust account sales',
                        tone: 'minus',
                        value: out.house,
                      },
                    ]}
                  />
                  <SummaryBlock
                    title="Other Money Received"
                    symbol="+ $"
                    type="money"
                    rows={[
                      {
                        key: 'custPayments',
                        label: 'Cust account payments',
                        tone: 'plus',
                        value: ZERO,
                      },
                      {
                        key: 'generalReceived',
                        label: 'General Account received',
                        tone: 'plus',
                        value: ZERO,
                      },
                    ]}
                  />
                </div>

                <div>
                  <SummaryBlock
                    title="ATM Reading"
                    note="The ATM is not part of the register; these show 0."
                    symbol="$"
                    type="money"
                    rows={[
                      {
                        key: 'atmTrans',
                        label: '# of ATM Trans',
                        symbol: '#',
                        type: 'count',
                        value: 0,
                      },
                      {
                        key: 'atmDispensed',
                        label: 'Amt Dispensed',
                        value: ZERO,
                      },
                      {
                        key: 'atmFee',
                        label: 'ATM Fee Collected',
                        value: ZERO,
                      },
                    ]}
                    totalLabel="ATM Net EFT"
                    total={ZERO}
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {!loading && !loadError && depts.data && (
        <div className="daily-report__totals" role="status" aria-label="Day totals">
          <div className="daily-report__total daily-report__total--in">
            <span className="daily-report__total-label">Total Money In</span>
            <span className="daily-report__total-value mono">{formatCell(totals.moneyIn, 'money')}</span>
          </div>
          <div className="daily-report__total daily-report__total--out">
            <span className="daily-report__total-label">Total Money Out</span>
            <span className="daily-report__total-value mono">{formatCell(totals.moneyOut, 'money')}</span>
          </div>
          <div className={`daily-report__total daily-report__total--${overShortTone(totals.overShort)}`}>
            <span className="daily-report__total-label">Over/Short</span>
            <span className="daily-report__total-value mono">{formatCell(totals.overShort, 'money')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
export default DailyReportPage;

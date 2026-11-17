import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../session/SessionContext.jsx';
import {
  getDepartments,
  getFuel,
  getPayments,
  getCashMovements,
  getDaySummary,
  getLotteryEntry,
  saveLotteryEntry,
  getMoneyEntry,
  saveMoneyEntry,
} from '../api/reports.js';
import { LotteryEditBlock } from '../ui/LotteryEditBlock.jsx';
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
 * - The other reading rows (settlement, adjustment, credits, commission) are not in the POS; admin / staff
 *   enter them (lotteryFigures applies the entered values and works out the Balance).
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

  return {
    split,
    scratch,
    online,
    combined,
    cashes,
  };
}

/** Lottery figures admin / staff may enter (keys of /api/reports/daily-lottery `values`). */
export const LOTTERY_FIELDS = {
  lottery_sales: 'amount',
  lottery_tickets: 'count',
  scratch_sales: 'amount',
  scratch_tickets: 'count',
  online_sales: 'amount',
  online_tickets: 'count',
  online_cashes: 'amount',
  scratch_cashes: 'amount',
  cashes_tickets: 'count',
  settlement: 'amount',
  adjustment: 'amount',
  online_credit: 'amount',
  scratch_credit: 'amount',
  commission: 'amount',
};

/**
 * The lottery figures shown on the page: the entered value where admin / staff entered one, the POS value
 * otherwise (rows the POS does not record are 0). Each field: { pos, value, edited } with amounts as
 * "0.00" strings and counts as numbers (null = no count).
 * - Balance = sales − online cashes − scratch-off cashes + settlement − adjustment − online credit
 *   − scratch-off credit − commission; sales = online sales, or the combined lottery sales when the register
 *   does not split scratch-off / online.
 * - moneyInCents  = lottery sales (scratch-off + online, or combined) + settlement + commission
 * - moneyOutCents = online cashes + scratch-off cashes + adjustment + online credit + scratch-off credit
 */
export function lotteryFigures(lotto, entered) {
  const pos = {
    lottery_sales: lotto.split ? null : lotto.combined.amount,
    lottery_tickets: lotto.split ? null : lotto.combined.tickets,
    scratch_sales: lotto.split ? lotto.scratch.amount : null,
    scratch_tickets: lotto.split ? lotto.scratch.tickets : null,
    online_sales: lotto.split ? lotto.online.amount : null,
    online_tickets: lotto.split ? lotto.online.tickets : null,
    online_cashes: '0.00',
    scratch_cashes: lotto.cashes.amount,
    cashes_tickets: lotto.cashes.tickets,
    settlement: '0.00',
    adjustment: '0.00',
    online_credit: '0.00',
    scratch_credit: '0.00',
    commission: '0.00',
  };
  const values = entered || {};
  const fields = {};
  for (const [key, kind] of Object.entries(LOTTERY_FIELDS)) {
    const has = values[key] !== undefined && values[key] !== null;
    const raw = has ? values[key] : pos[key];
    const value = kind === 'count' ? (raw === null || raw === undefined ? null : Number(raw)) : fromCents(toCents(raw));
    fields[key] = { pos: pos[key], value, edited: has };
  }
  const c = (key) => toCents(fields[key].value);
  const salesCents = lotto.split ? c('scratch_sales') + c('online_sales') : c('lottery_sales');
  const balanceCents =
    (lotto.split ? c('online_sales') : c('lottery_sales')) -
    c('online_cashes') -
    c('scratch_cashes') +
    c('settlement') -
    c('adjustment') -
    c('online_credit') -
    c('scratch_credit') -
    c('commission');
  return {
    split: lotto.split,
    fields,
    balance: fromCents(balanceCents),
    moneyInCents: salesCents + c('settlement') + c('commission'),
    moneyOutCents:
      c('online_cashes') + c('scratch_cashes') + c('adjustment') + c('online_credit') + c('scratch_credit'),
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

/** Money Out figures admin / staff may enter (keys of /api/reports/daily-money `values`). */
export const MONEY_FIELDS = {
  cash_deposit: 'amount',
  check_deposit: 'amount',
  card_batch: 'amount',
  generic_card_1: 'amount',
  generic_card_2: 'amount',
  ebt: 'amount',
  cash_purchases: 'amount',
  cash_expenses: 'amount',
  general_account_paid: 'amount',
  other_income: 'amount',
  cust_account_sales: 'amount',
  cust_account_payments: 'amount',
  general_account_received: 'amount',
  atm_trans: 'count',
  atm_dispensed: 'amount',
  atm_fee: 'amount',
};

/**
 * The Money Out figures shown on the page: the entered value where admin / staff entered one, the POS value
 * otherwise. POS defaults: cash deposit = safe drops, card batch = card payments, EBT = EBT payments, cash
 * purchases = paid-outs, other income = pay-ins, cust account sales = house charges; every other row is not in
 * the POS (0). Each field: { pos, value, edited } (amounts as "0.00" strings, the ATM count as a number).
 * - totalDeposits = cash deposit + check deposit
 * - atmNet        = ATM amount dispensed + ATM fee collected (display only)
 * - out           = the figures dailyTotals counts (same keys as moneyOut, plus the rows the POS lacks)
 * `pos` is the result of moneyOut (POS figures).
 */
export function moneyOutFigures(pos, entered) {
  const posValues = {
    cash_deposit: pos.deposits,
    check_deposit: '0.00',
    card_batch: pos.card,
    generic_card_1: '0.00',
    generic_card_2: '0.00',
    ebt: pos.ebt,
    cash_purchases: pos.paidOuts,
    cash_expenses: '0.00',
    general_account_paid: '0.00',
    other_income: pos.payIns,
    cust_account_sales: pos.house,
    cust_account_payments: '0.00',
    general_account_received: '0.00',
    atm_trans: 0,
    atm_dispensed: '0.00',
    atm_fee: '0.00',
  };
  const values = entered || {};
  const fields = {};
  for (const [key, kind] of Object.entries(MONEY_FIELDS)) {
    const has = values[key] !== undefined && values[key] !== null;
    const raw = has ? values[key] : posValues[key];
    fields[key] = {
      pos: posValues[key],
      value: kind === 'count' ? Number(raw) || 0 : fromCents(toCents(raw)),
      edited: has,
    };
  }
  const v = (key) => fields[key].value;
  const c = (key) => toCents(v(key));
  const totalDeposits = fromCents(c('cash_deposit') + c('check_deposit'));
  return {
    fields,
    totalDeposits,
    atmNet: fromCents(c('atm_dispensed') + c('atm_fee')),
    out: {
      deposits: totalDeposits,
      card: v('card_batch'),
      generic1: v('generic_card_1'),
      generic2: v('generic_card_2'),
      ebt: v('ebt'),
      paidOuts: v('cash_purchases'),
      cashExpenses: v('cash_expenses'),
      generalPaid: v('general_account_paid'),
      payIns: v('other_income'),
      house: v('cust_account_sales'),
      custPayments: v('cust_account_payments'),
      generalReceived: v('general_account_received'),
    },
  };
}

/**
 * Footer totals of one day (strings, 2 decimals).
 * - Money In  = Total Grocery + Total Gas Amt Sold + sales tax
 *   + lottery (sales + settlement + commission, see lotteryFigures)
 *   + Other Money Received (cust account payments + general account received).
 * - Money Out = following the signs of the paper report: every "− $" row added, "+ $" Other Income subtracted:
 *   total deposits + card batch + generic cards 1 and 2 + EBT + cash purchases + cash expenses
 *   + general account paid + cust account sales + lottery (cashes + adjustment + credits) − other income.
 * - ATM Reading is display only.
 * `lottery` is the result of lotteryFigures and `out` the `out` of moneyOutFigures (entered values applied);
 * missing keys count as 0.
 */
export function dailyTotals({ merch, grades, lottery, tax, out }) {
  const c = (k) => toCents(out[k]);
  const moneyIn =
    sumCents(merch, 'amount') +
    sumCents(grades, 'amount') +
    lottery.moneyInCents +
    toCents(tax) +
    c('custPayments') +
    c('generalReceived');
  const moneyOut =
    c('deposits') +
    c('card') +
    c('generic1') +
    c('generic2') +
    c('ebt') +
    c('paidOuts') +
    c('cashExpenses') +
    c('generalPaid') +
    c('house') +
    lottery.moneyOutCents -
    c('payIns');
  // Over/Short = Total Money Out − Total Money In (negative = short, positive = over).
  return { moneyIn: fromCents(moneyIn), moneyOut: fromCents(moneyOut), overShort: fromCents(moneyOut - moneyIn) };
}

/** "2026-11-17T09:30:00Z" -> "Nov 17, 2026, 3:00 PM" in the viewer's own clock (when the edit was saved). */
export function formatEditTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
  const posOut = useMemo(() => moneyOut(payments.data, moves.data), [payments.data, moves.data]);

  // Money Out figures entered by admin / staff (every Money Out table; they replace the POS figure field by field).
  const [moneyReload, setMoneyReload] = useState(0);
  const moneyEntry = useReport((p) => getMoneyEntry(p.vendor, { store: p.store, date: p.to }), [moneyReload]);
  const money = useMemo(() => moneyOutFigures(posOut, moneyEntry.data?.values), [posOut, moneyEntry.data]);
  const out = money.out;
  const moneyEditProps = {
    fields: money.fields,
    kinds: MONEY_FIELDS,
    canEdit: Boolean(moneyEntry.data?.can_edit),
    onSave: (values) => saveMoney(values),
  };
  const saveMoney = async (values) => {
    try {
      await saveMoneyEntry(
        selectedStore?.pos_vendor,
        { store: selectedStore?.store_code, date: day },
        { version: moneyEntry.data?.version ?? 0, values },
      );
    } finally {
      setMoneyReload((n) => n + 1); // show what is stored now (also after a 409)
    }
  };
  const moneyLastEdited = moneyEntry.data?.updated_by_name
    ? `Last edited by ${moneyEntry.data.updated_by_name}, ${formatEditTime(moneyEntry.data.updated_at)}`
    : null;

  const ZERO = '0.00';

  // Lottery figures entered by admin / staff (they replace the POS figure field by field).
  const [entryReload, setEntryReload] = useState(0);
  const entry = useReport((p) => getLotteryEntry(p.vendor, { store: p.store, date: p.to }), [entryReload]);
  const lottery = useMemo(() => lotteryFigures(lotto, entry.data?.values), [lotto, entry.data]);
  const canEditLottery = Boolean(entry.data?.can_edit);

  const saveLottery = async (values) => {
    try {
      await saveLotteryEntry(
        selectedStore?.pos_vendor,
        { store: selectedStore?.store_code, date: day },
        { version: entry.data?.version ?? 0, values },
      );
    } finally {
      setEntryReload((n) => n + 1); // show what is stored now (also after a 409)
    }
  };

  const lastEdited = entry.data?.updated_by_name
    ? `Last edited by ${entry.data.updated_by_name}, ${formatEditTime(entry.data.updated_at)}`
    : null;

  const ticketsSoldRows = lottery.split
    ? [{ key: 'scratch_sales', countKey: 'scratch_tickets', label: 'Scratch-off sales', symbol: '+ $', tone: 'plus' }]
    : [{ key: 'lottery_sales', countKey: 'lottery_tickets', label: 'Lottery sales', symbol: '+ $', tone: 'plus' }];
  const readingRows = [
    ...(lottery.split
      ? [{ key: 'online_sales', countKey: 'online_tickets', label: 'Net online sales', symbol: '+ $', tone: 'plus' }]
      : []),
    { key: 'online_cashes', label: 'Net online cashes', symbol: '− $', tone: 'minus' },
    { key: 'scratch_cashes', countKey: 'cashes_tickets', label: 'Scratch-off cashes', symbol: '− $', tone: 'minus' },
    { key: 'settlement', label: 'Settlement', symbol: '$' },
    { key: 'adjustment', label: 'Adjustment', symbol: '− $', tone: 'minus' },
    { key: 'online_credit', label: 'Online credit', symbol: '− $', tone: 'minus' },
    { key: 'scratch_credit', label: 'Scratch-off credit', symbol: '− $', tone: 'minus' },
    { key: 'commission', label: 'Commission', symbol: '$' },
  ];

  const summary = useReport((p) => getDaySummary(p.vendor, { store: p.store, from: p.to, to: p.to }));
  const tax = summary.data?.[0]?.tax ?? null;
  const totals = useMemo(() => dailyTotals({ merch, grades, lottery, tax, out }), [merch, grades, lottery, tax, out]);

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
                    {entry.error && (
                      <div className="lottery-edit__message" role="alert">
                        Entered lottery figures could not be loaded; POS figures are shown.
                      </div>
                    )}
                    <LotteryEditBlock
                      title="Lottery Tickets Sold"
                      note={
                        lottery.split
                          ? `${dayLabel} · scratch-off tickets sold at the register.`
                          : `${dayLabel} · all lottery sold at the register. This register does not separate scratch-off and online.`
                      }
                      rows={ticketsSoldRows}
                      fields={lottery.fields}
                      kinds={LOTTERY_FIELDS}
                      canEdit={canEditLottery}
                      onSave={saveLottery}
                      lastEdited={lastEdited}
                    />
                    <LotteryEditBlock
                      title="Lottery/Lotto Reading"
                      note="Cashes are all lottery winnings paid at the register (the register does not split online and scratch-off). Settlement, adjustment, credits and commission are not recorded by the register: 0.00 until admin or staff enter them."
                      rows={readingRows}
                      fields={lottery.fields}
                      kinds={LOTTERY_FIELDS}
                      canEdit={canEditLottery}
                      onSave={saveLottery}
                      lastEdited={lastEdited}
                      totalLabel="Balance"
                      total={lottery.balance}
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
                  {moneyEntry.error && (
                    <div className="lottery-edit__message" role="alert">
                      Entered Money Out figures could not be loaded; POS figures are shown.
                    </div>
                  )}
                  <LotteryEditBlock
                    {...moneyEditProps}
                    title="Safe Deposits"
                    note={`${dayLabel} · cash deposit = safe drops; check deposit is not recorded by the register (0.00 until entered); card batch = all card payments (credit, debit, pump, mobile).`}
                    lastEdited={moneyLastEdited}
                    rows={[
                      { key: 'cash_deposit', label: 'Cash deposit', symbol: '− $', tone: 'minus' },
                      { key: 'check_deposit', label: 'Check deposit', symbol: '− $', tone: 'minus' },
                      {
                        key: 'total_deposits',
                        label: 'Total deposits',
                        symbol: '− $',
                        tone: 'minus',
                        computed: true,
                        value: money.totalDeposits,
                      },
                      { key: 'card_batch', label: 'Credit card batch', symbol: '− $', tone: 'minus' },
                    ]}
                  />
                  <LotteryEditBlock
                    {...moneyEditProps}
                    title="Credit Card 2 (Credited in Bank)"
                    note="Not recorded by the register: 0.00 until entered."
                    lastEdited={moneyLastEdited}
                    rows={[
                      { key: 'generic_card_1', label: 'Sales by generic card 1', symbol: '− $', tone: 'minus' },
                      { key: 'generic_card_2', label: 'Sales by generic card 2', symbol: '− $', tone: 'minus' },
                    ]}
                  />
                  <LotteryEditBlock
                    {...moneyEditProps}
                    title="Bank Deposits"
                    note="EBT/Foodstamp = EBT payments at the register."
                    lastEdited={moneyLastEdited}
                    rows={[{ key: 'ebt', label: 'EBT/Foodstamp', symbol: '− $', tone: 'minus' }]}
                  />
                </div>

                <div>
                  <LotteryEditBlock
                    {...moneyEditProps}
                    title="Cash Purchases"
                    note="Cash purchases = store paid-outs. Other income = pay-ins. Customer account sales = house charges. Cash expenses and general account paid: 0.00 until entered."
                    lastEdited={moneyLastEdited}
                    rows={[
                      { key: 'cash_purchases', label: 'Cash Purchases', symbol: '− $', tone: 'minus' },
                      { key: 'cash_expenses', label: 'Cash Expenses', symbol: '− $', tone: 'minus' },
                      { key: 'general_account_paid', label: 'General Account paid', symbol: '− $', tone: 'minus' },
                      { key: 'other_income', label: 'Other Income', symbol: '+ $', tone: 'plus' },
                      { key: 'cust_account_sales', label: 'Cust account sales', symbol: '− $', tone: 'minus' },
                    ]}
                  />
                  <LotteryEditBlock
                    {...moneyEditProps}
                    title="Other Money Received"
                    note="Not recorded by the register: 0.00 until entered. Counted in Total Money In."
                    lastEdited={moneyLastEdited}
                    rows={[
                      { key: 'cust_account_payments', label: 'Cust account payments', symbol: '+ $', tone: 'plus' },
                      {
                        key: 'general_account_received',
                        label: 'General Account received',
                        symbol: '+ $',
                        tone: 'plus',
                      },
                    ]}
                  />
                </div>

                <div>
                  <LotteryEditBlock
                    {...moneyEditProps}
                    title="ATM Reading"
                    note="The ATM is not part of the register: 0 until entered. Shown only; not counted in the totals."
                    lastEdited={moneyLastEdited}
                    rows={[
                      { key: 'atm_trans', label: '# of ATM Trans', symbol: '#' },
                      { key: 'atm_dispensed', label: 'Amt Dispensed', symbol: '$' },
                      { key: 'atm_fee', label: 'ATM Fee Collected', symbol: '$' },
                    ]}
                    totalLabel="ATM Net EFT"
                    total={money.atmNet}
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

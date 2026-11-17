import { describe, it, expect } from 'vitest';
import { merchandiseRows, fuelRows, lotteryReport, moneyOut, paymentBucket, dailyTotals, overShortTone } from '../src/pages/DailyReportPage.jsx';
import { sumCents, fromCents, sumMilli, fromMilli } from '../src/num.js';

const row = (dept_number, dept_name, sales_class, net_sales) => ({ dept_number, dept_name, sales_class, net_sales });

describe('merchandiseRows', () => {
  it('keeps merchandise only, in department-number order, naming unnamed departments', () => {
    const rows = merchandiseRows([
      row(12, 'Beer', 'merchandise', '40.10'),
      row(5, null, 'merchandise', '3.00'),
      row(57, 'LOTTO ONLINE', 'lottery_sale', '20.00'),
      row(9998, 'FUEL', 'fuel', '100.00'),
      row(2, 'Cigarettes', 'merchandise', '0.20'),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Cigarettes', 'Department #5', 'Beer']);
  });

  it('Total Grocery adds the department values to the cent', () => {
    const rows = merchandiseRows([row(1, 'A', 'merchandise', '0.10'), row(2, 'B', 'merchandise', '0.20')]);
    expect(fromCents(sumCents(rows, 'amount'))).toBe('0.30');
  });

  it('handles no data', () => {
    expect(merchandiseRows(null)).toEqual([]);
  });
});

describe('fuelRows', () => {
  it('lists every grade the POS reported, including one with nothing pumped', () => {
    const rows = fuelRows([
      { fuel_grade: 'Diesel', gallons: '10.500', amount: '40.00' },
      { fuel_grade: 'INVALID018', gallons: '0.000', amount: '0.00' },
      { fuel_grade_id: 1, fuel_grade: 'REGULAR', gallons: '0.001', amount: '0.01' },
    ]);
    expect(rows.map((r) => r.grade)).toEqual(['Diesel', 'Invalid018', 'Regular']);
    expect(fromMilli(sumMilli(rows, 'gallons'))).toBe('10.501');
    expect(fromCents(sumCents(rows, 'amount'))).toBe('40.01');
  });

  it('handles no data', () => {
    expect(fuelRows(undefined)).toEqual([]);
  });
});

const lot = (dept_number, dept_name, sales_class, units_sold, net_sales) =>
  ({ dept_number, dept_name, sales_class, units_sold, net_sales });

describe('lotteryReport', () => {
  it('splits scratch-off / online when the register has both departments (Gilbarco 800, 2026-10-24)', () => {
    const r = lotteryReport([
      lot(5, 'LOTTO SCRATCH OFF', 'lottery_sale', '257.000', '655.00'),
      lot(57, 'LOTTO ONLINE', 'lottery_sale', '47.000', '760.00'),
      lot(6, 'LOTTO PAID OUT', 'lottery_payout', '43.000', '-934.00'),
      lot(3, 'Beer', 'merchandise', '10.000', '99.00'),
    ]);
    expect(r.split).toBe(true);
    expect(r.scratch).toMatchObject({ amount: '655.00', tickets: 257 });
    expect(r.online).toMatchObject({ amount: '760.00', tickets: 47 });
    expect(r.cashes).toMatchObject({ amount: '934.00', tickets: 43 });
    expect(r.balance).toBe('-174.00');
  });

  it('uses one combined sales figure when the register has a single Lotto department (Verifone 8730, 2026-10-15)', () => {
    const r = lotteryReport([
      lot(29, 'Lotto', 'lottery_sale', '51.000', '852.00'),
      lot(28, 'Lotto Payout', 'lottery_payout', '-20.000', '-1063.00'),
    ]);
    expect(r.split).toBe(false);
    expect(r.combined).toMatchObject({ amount: '852.00', tickets: 51 });
    expect(r.cashes).toMatchObject({ amount: '1063.00', tickets: 20 });
    expect(r.balance).toBe('-211.00');
  });

  it('shows 0.00 with no ticket count when there was no lottery', () => {
    const r = lotteryReport([]);
    expect(r.combined).toEqual({ amount: '0.00', cents: 0, tickets: null });
    expect(r.cashes.amount).toBe('0.00');
    expect(r.balance).toBe('0.00');
  });
});

describe('moneyOut', () => {
  // Gilbarco 800_NY-13208, 2026-10-24 (matches the store's paper report: 4457.00, 5838.74, 33.94)
  const payments = [
    { payment_type: 'Cash', tender_code: 'cash', net_amount: '4679.49' },
    { payment_type: 'Credit', tender_code: 'creditCards', net_amount: '2274.94' },
    { payment_type: 'Crind CREDIT', tender_code: 'outsideCredit', net_amount: '1392.86' },
    { payment_type: 'Crind DEBIT', tender_code: 'outsideDebit', net_amount: '940.25' },
    { payment_type: 'Debit', tender_code: 'debitCards', net_amount: '1230.69' },
    { payment_type: 'EBT Food', tender_code: 'generic', net_amount: '26.83' },
    { payment_type: 'ebt/generic', tender_code: 'ebt', net_amount: '7.11' },
  ];
  const movements = [
    { kind: 'safe_drop', amount: '2000.00' },
    { kind: 'safe_drop', amount: '2457.00' },
    { kind: 'safe_loan', amount: '600.00' },
  ];

  it('reproduces the paper report figures', () => {
    expect(moneyOut(payments, movements)).toEqual({
      deposits: '4457.00',
      card: '5838.74',
      ebt: '33.94',
      house: '0.00',
      paidOuts: '0.00',
      payIns: '0.00',
    });
  });

  it('maps paid-outs, pay-ins, house charges and Verifone mobile payments', () => {
    const r = moneyOut(
      [
        { payment_type: 'MOBILE', net_amount: '30.00' },
        { payment_type: 'CREDIT', net_amount: '10.00' },
        { payment_type: 'HOUSE', net_amount: '71.09' },
        { payment_type: 'COUPON', net_amount: '9.45' },
      ],
      [{ kind: 'payout', amount: '25.00' }, { kind: 'pay_in', amount: '10.25' }]
    );
    expect(r).toMatchObject({ card: '40.00', house: '71.09', paidOuts: '25.00', payIns: '10.25' });
    expect(paymentBucket({ payment_type: 'COUPON' })).toBeNull();
    expect(paymentBucket({ payment_type: 'CASH' })).toBeNull();
  });

  it('is all 0.00 without data', () => {
    expect(moneyOut(null, undefined).deposits).toBe('0.00');
  });
});

describe('dailyTotals', () => {
  // Gilbarco 800_NY-13208, 2026-10-24
  it('Money In = grocery + gas + lottery sales + tax; Money Out includes lottery cashes', () => {
    const lotto = lotteryReport([
      lot(5, 'LOTTO SCRATCH OFF', 'lottery_sale', '257.000', '655.00'),
      lot(57, 'LOTTO ONLINE', 'lottery_sale', '47.000', '760.00'),
      lot(6, 'LOTTO PAID OUT', 'lottery_payout', '43.000', '-934.00'),
    ]);
    const t = dailyTotals({
      merch: [{ amount: '3347.11' }],
      grades: [{ amount: '6523.64' }],
      lotto,
      tax: '201.04',
      out: { deposits: '4457.00', card: '5838.74', ebt: '33.94', house: '0.00', paidOuts: '0.00', payIns: '0.00' },
    });
    expect(t).toEqual({ moneyIn: '11486.79', moneyOut: '11263.68', overShort: '-223.11' });
  });

  it('subtracts pay-ins (Other Income) from Money Out and uses combined lottery sales', () => {
    const lotto = lotteryReport([
      lot(29, 'Lotto', 'lottery_sale', '51.000', '852.00'),
      lot(28, 'Lotto Payout', 'lottery_payout', '-20.000', '-1063.00'),
    ]);
    const t = dailyTotals({
      merch: [],
      grades: [],
      lotto,
      tax: null,
      out: { deposits: '100.00', card: '0.00', ebt: '0.00', house: '5.00', paidOuts: '20.00', payIns: '10.25' },
    });
    expect(t).toEqual({ moneyIn: '852.00', moneyOut: '1177.75', overShort: '325.75' });
  });
});

describe('overShortTone', () => {
  it('is red (out) when short, green (in) when over, neutral at zero', () => {
    expect(overShortTone('-223.11')).toBe('out');
    expect(overShortTone('325.75')).toBe('in');
    expect(overShortTone('0.00')).toBe('zero');
  });
});

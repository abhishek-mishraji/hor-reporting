import { describe, it, expect } from 'vitest';
import { merchandiseRows, fuelRows } from '../src/pages/DailyReportPage.jsx';
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

import { describe, it, expect } from 'vitest';
import {
  toCents,
  toMilli,
  fromCents,
  fromMilli,
  sumCents,
  sumMilli,
  sumInt,
  roundHalfUp2,
  isNonAdditiveColumn,
  hasNoData,
} from '../src/num.js';

describe('num.js utilities', () => {
  it('converts dollar values to integer cents with proper rounding and null handling', () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents('')).toBe(0);
    expect(toCents('0')).toBe(0);
    expect(toCents(10.25)).toBe(1025);
    expect(toCents('10.25')).toBe(1025);
    expect(toCents(-1435.00)).toBe(-143500);
    expect(toCents(0.07)).toBe(7);
    expect(toCents(0.01 + 0.02)).toBe(3); // floating point tolerance
  });

  it('converts gallons to integer thousandths with proper precision', () => {
    expect(toMilli(null)).toBe(0);
    expect(toMilli(undefined)).toBe(0);
    expect(toMilli('')).toBe(0);
    expect(toMilli(1698.399)).toBe(1698399);
    expect(toMilli('5752.387')).toBe(5752387);
    expect(toMilli(0.001)).toBe(1);
  });

  it('formats cents and milli back to strings', () => {
    expect(fromCents(1025)).toBe('10.25');
    expect(fromCents(-143500)).toBe('-1435.00');
    expect(fromCents(0)).toBe('0.00');
    expect(fromCents(null)).toBe('0.00');

    expect(fromMilli(1698399)).toBe('1698.399');
    expect(fromMilli(5752387)).toBe('5752.387');
    expect(fromMilli(0)).toBe('0.000');
  });

  it('sums cents correctly over lists avoiding float errors', () => {
    const list = [
      { amount: 10.25 },
      { amount: '0.07' },
      { amount: null },
      { amount: undefined },
      { amount: -5.00 },
    ];
    // 1025 + 7 + 0 + 0 - 500 = 532
    expect(sumCents(list, 'amount')).toBe(532);
    expect(fromCents(sumCents(list, 'amount'))).toBe('5.32');
  });

  it('sums gallons correctly over lists', () => {
    const list = [
      { gallons: 100.123 },
      { gallons: '200.456' },
      { gallons: null },
    ];
    // 100123 + 200456 = 300579
    expect(sumMilli(list, 'gallons')).toBe(300579);
    expect(fromMilli(sumMilli(list, 'gallons'))).toBe('300.579');
  });

  it('sums integer counts correctly', () => {
    const list = [
      { count: 5 },
      { count: '10' },
      { count: null },
      { count: 'invalid' },
    ];
    expect(sumInt(list, 'count')).toBe(15);
  });

  it('rounds half-up to 2 decimals matching Daily Register requirements', () => {
    expect(roundHalfUp2(null)).toBe('0.00');
    expect(roundHalfUp2('')).toBe('0.00');
    expect(roundHalfUp2('1698.399')).toBe('1698.40'); // Wolf gallons rounding
    expect(roundHalfUp2(5046.789)).toBe('5046.79');
    expect(roundHalfUp2(2.555)).toBe('2.56');
    expect(roundHalfUp2(-2.555)).toBe('-2.56');
  });

  it('identifies non-additive columns correctly', () => {
    expect(isNonAdditiveColumn('store_id')).toBe(true);
    expect(isNonAdditiveColumn('dept_number')).toBe(true);
    expect(isNonAdditiveColumn('file_id')).toBe(true);
    expect(isNonAdditiveColumn('avg_price')).toBe(true);
    expect(isNonAdditiveColumn('tax_rate')).toBe(true);
    expect(isNonAdditiveColumn('item_sales')).toBe(false);
    expect(isNonAdditiveColumn('net_amount')).toBe(false);
  });

  it('correctly detects hasNoData', () => {
    expect(hasNoData([], 'field')).toBe(true);
    expect(hasNoData([{ a: null }, { a: '' }], 'a')).toBe(true);
    expect(hasNoData([{ a: null }, { a: 0 }], 'a')).toBe(false);
    expect(hasNoData([{ a: 'hello' }], 'a')).toBe(false);
  });
});

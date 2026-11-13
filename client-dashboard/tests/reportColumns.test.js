import { describe, it, expect } from 'vitest';
import { formatCell } from '../src/format.js';
import {
  availableColumns,
  columnPrefsVersion,
  groupBySalesClass,
  REPORT_COLUMNS,
  upgradeColumnPrefs,
} from '../src/reportColumns.js';

describe('formatCell', () => {
  it('formats money, gallons and counts, and keeps missing values blank', () => {
    expect(formatCell(1438.52, 'money')).toBe('$1,438.52');
    expect(formatCell(-1239, 'money')).toBe('-$1,239.00');
    expect(formatCell('12.5', 'gallons')).toBe('12.500');
    expect(formatCell(1200, 'count')).toBe('1,200');
    expect(formatCell(null, 'money')).toBe('');
    expect(formatCell(undefined, 'count')).toBe('');
  });

  it('formats dates and times without time-zone conversion', () => {
    expect(formatCell('2026-10-24', 'date')).toBe('Oct 24, 2026');
    expect(formatCell('2026-10-24T00:05:09', 'time')).toBe('12:05 AM');
    expect(formatCell('2026-10-24T13:45:00', 'time')).toBe('1:45 PM');
  });

  it('maps codes to labels', () => {
    expect(formatCell('safe_drop', 'label', { safe_drop: 'Safe drop' })).toBe('Safe drop');
    expect(formatCell('unknown', 'label', {})).toBe('unknown');
  });
});

describe('availableColumns', () => {
  it('never offers fields missing from the catalog, such as ids and tie checks', () => {
    const rows = [{ store_id: 1, store_code: 'X', files: 3, counter_ties: true, business_date: '2026-10-24', merchandise_net: 10 }];
    expect(availableColumns('daySummary', rows).map((c) => c.key)).toEqual(['business_date', 'merchandise_net']);
  });

  it('only offers columns the server returned', () => {
    const cols = availableColumns('fuel', [{ fuel_grade: 'Regular', gallons: 1, amount: 3, fuel_discount: 0 }]);
    expect(cols.map((c) => c.key)).toEqual(['fuel_grade', 'gallons', 'amount', 'fuel_discount']);
  });

  it('has unique keys per report', () => {
    for (const [id, cols] of Object.entries(REPORT_COLUMNS)) {
      expect(new Set(cols.map((c) => c.key)).size, id).toBe(cols.length);
    }
  });
});

describe('groupBySalesClass', () => {
  it('keeps lottery and fuel out of the merchandise section', () => {
    const rows = [
      { deptCode: 29, deptName: 'Lotto', salesClass: 'lottery_sale', netSales: 1438.5 },
      { deptCode: 1, deptName: 'Grocery', salesClass: 'merchandise', netSales: 100 },
      { deptCode: 28, deptName: 'Lotto Payout', salesClass: 'lottery_payout', netSales: -1239 },
      { deptCode: 40, deptName: 'Fuel', salesClass: 'fuel', netSales: 50 },
      { deptCode: 2, deptName: 'Beer', salesClass: 'merchandise', netSales: 20 },
    ];
    const groups = groupBySalesClass(rows, 'salesClass');
    expect(groups.map((g) => g.id)).toEqual(['merchandise', 'lottery_sale', 'lottery_payout', 'fuel']);
    expect(groups[0].rows.map((r) => r.deptName)).toEqual(['Grocery', 'Beer']);
  });

  it('puts rows without a known class under Other', () => {
    const groups = groupBySalesClass([{ salesClass: undefined }], 'salesClass');
    expect(groups.map((g) => g.label)).toEqual(['Other']);
  });
});

describe('day summary suspicious-activity columns', () => {
  const vRow = {
    business_date: '2026-10-15', no_sales: 3, void_lines: 21, void_line_amount: 114.73, voids: 10, void_amount: 785.4,
    total_void_amount: 900.13, refunds: 0, refund_amount: 0, refunded_money: 0, refund_voids: 0,
  };
  const gRow = Object.fromEntries(Object.entries(vRow).filter(([k]) => k !== 'refunded_money' && k !== 'refund_voids'));

  it('shows counts, total void amount and refund amount by default', () => {
    const shown = REPORT_COLUMNS.daySummary.filter((c) => c.show).map((c) => c.key);
    expect(shown).toEqual(expect.arrayContaining(['no_sales', 'void_lines', 'voids', 'total_void_amount', 'refunds', 'refund_amount']));
    expect(shown).not.toEqual(expect.arrayContaining(['void_line_amount']));
    expect(shown).not.toContain('void_amount');
    expect(shown).not.toContain('refunded_money');
    expect(shown).not.toContain('refund_voids');
  });

  it('keeps the requested order', () => {
    expect(availableColumns('daySummary', [vRow]).map((c) => c.key)).toEqual([
      'business_date', 'no_sales', 'void_lines', 'void_line_amount', 'voids', 'void_amount', 'total_void_amount',
      'refunds', 'refund_amount', 'refunded_money', 'refund_voids',
    ]);
  });

  it('never offers Verifone-only refund columns for Gilbarco rows', () => {
    const keys = availableColumns('daySummary', [gRow]).map((c) => c.key);
    expect(keys).not.toContain('refunded_money');
    expect(keys).not.toContain('refund_voids');
  });
});

describe('voidItems columns', () => {
  it('offers Items voided only when the rows have it (Gilbarco)', () => {
    const v = { business_date: '2026-10-15', kind: 'void_line', item: 'COKE', quantity: 1, amount: 2.49, ticket_seq: 4 };
    expect(availableColumns('voidItems', [v]).map((c) => c.key)).not.toContain('lines');
    expect(availableColumns('voidItems', [{ ...v, lines: 2 }]).map((c) => c.key)).toContain('lines');
  });
});

describe('upgradeColumnPrefs', () => {
  it('stores day-summary choices under a new version', () => {
    expect(columnPrefsVersion('daySummary')).toBe(2);
    expect(columnPrefsVersion('items')).toBe(1);
  });

  it('gives users with nothing saved the new defaults', () => {
    expect(upgradeColumnPrefs('daySummary', {})).toEqual({});
    expect(upgradeColumnPrefs('daySummary', null)).toEqual({});
  });

  it('keeps every column of a saved choice looking as before', () => {
    // saved before the change: turned Promotions on and No sales on, Tax off
    const up = upgradeColumnPrefs('daySummary', { promotions: true, no_sales: true, tax: false });
    expect(up).toEqual({
      promotions: true,
      tax: false,
      void_lines: false,
      voids: false,
      refunds: false,
      total_void_amount: false,
      refund_amount: false,
    });
  });

  it('keeps a column the user turned on even if it is now off by default', () => {
    expect(upgradeColumnPrefs('daySummary', { refunded_money: true })).toMatchObject({ refunded_money: true });
  });

  it('leaves reports whose defaults never changed alone', () => {
    expect(upgradeColumnPrefs('items', { upc: false })).toEqual({ upc: false });
  });
});

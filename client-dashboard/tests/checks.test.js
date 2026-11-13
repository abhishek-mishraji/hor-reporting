import { describe, it, expect } from 'vitest';
import { runVerificationChecks } from '../src/checks/runChecks.js';

describe('runVerificationChecks', () => {
  it('returns NO DATA for checks when dataset is empty', () => {
    const results = runVerificationChecks({
      vendor: 'VERIFONE',
      day: [],
      items: [],
      dept: [],
      fuel: [],
      pay: [],
      cash: [],
      sd: [],
      se: [],
      voids: [],
      lot: [],
      lotp: [],
      dr: { records: [] },
      mon: { departments: [], totals: {} },
      deptM: [],
    });

    const c01 = results.find((r) => r.id === 'C01');
    expect(c01?.result).toBe('NO DATA');

    const c09 = results.find((r) => r.id === 'C09');
    expect(c09?.result).toBe('NO DATA');
  });

  it('marks checks as PASS when fixtures tie exactly', () => {
    const day = [
      {
        business_date: '2026-10-15',
        item_sales: 100.0,
        merchandise_net: 100.0,
        lottery_sales: 20.0,
        lottery_payouts: -5.0,
        lottery_payout_count: 1,
        fuel_sales: 50.0,
        fuel_gallons: 15.123,
        tax: 8.0,
        total_sales_before_tax: 170.0,
        total_sales_with_tax: 178.0,
        payments_net: 173.0, // 178 + (-5) = 173
        ticket_totals: 173.0,
        promotions: 2.0,
        safe_drops: 1,
        safe_drop_amount: 50.0,
        cash_deposit: 50.0,
        check_deposit: 0.0,
        payouts: 0,
        payout_amount: 0.0,
        safe_loans: 0,
        safe_loan_amount: 0.0,
        no_sales: 1,
        void_lines: 2,
        voids: 1,
        refunds: 0,
      },
    ];

    const items = [
      { net_sales: 60.0 },
      { net_sales: 40.0 },
    ];

    const dept = [
      { sales_class: 'merchandise', net_sales: 100.0, promotions: 2.0, gross_sales: 102.0 },
      { sales_class: 'lottery_sale', net_sales: 20.0, promotions: 0.0, gross_sales: 20.0 },
      { sales_class: 'lottery_payout', net_sales: -5.0, promotions: 0.0, gross_sales: -5.0 },
      { sales_class: 'fuel', net_sales: 50.0, promotions: 0.0, gross_sales: 50.0 },
    ];

    const fuel = [
      { gallons: 15.123, amount: 50.0 },
    ];

    const pay = [
      { net_amount: 173.0 },
    ];

    const cash = [
      { kind: 'safe_drop', amount: 50.0 },
    ];

    const results = runVerificationChecks({
      vendor: 'VERIFONE',
      day,
      items,
      dept,
      fuel,
      pay,
      cash,
      sd: [{ kind: 'no_sale', occurrences: 1 }, { kind: 'void_line', occurrences: 2 }, { kind: 'void', occurrences: 1 }],
      se: [{ kind: 'no_sale' }, { kind: 'void_line' }, { kind: 'void_line' }, { kind: 'void' }],
      voids: [{ void_lines: 2, voids: 1, void_amount: 0, total_void_amount: 0 }],
      lot: [{ sales_amount: 20.0, payout_amount: 5.0, payouts: 1 }],
      lotp: [{ payout_amount: 5.0, payouts: 1 }],
      dr: {
        records: [
          {
            reportDate: '2026-10-15',
            groceryTotal: 100.0,
            volume: 15.12,
            noSale: 1,
            lineVoid: 2,
            voidAmount: 0.0,
            refunds: 0.0,
            cashDeposit: 50.0,
            checkDeposit: 0.0,
          },
        ],
      },
      mon: {
        departments: [{ gross: 172.0, refund: 0, promotion: 2.0, voidAmount: 5.0, discount: 0, netSales: 165.0 }],
        totals: { grossTotal: 172.0, refundTotal: 0, promotionTotal: 2.0, voidTotal: 5.0, discountTotal: 0, netSalesTotal: 165.0 },
      },
      deptM: [{ net_sales: 165.0 }],
    });

    const c01 = results.find((r) => r.id === 'C01');
    expect(c01?.result).toBe('PASS');

    const c02 = results.find((r) => r.id === 'C02');
    expect(c02?.result).toBe('PASS');

    const c11 = results.find((r) => r.id === 'C11');
    expect(c11?.result).toBe('PASS');

    const c22 = results.find((r) => r.id === 'C22');
    expect(c22?.result).toBe('PASS');

    const c24 = results.find((r) => r.id === 'C24');
    expect(c24?.result).toBe('PASS');
  });

  it('deliberately yields FAIL when numbers do not agree', () => {
    const day = [{ business_date: '2026-10-15', item_sales: 100.0, merchandise_net: 100.0 }];
    const items = [{ net_sales: 95.0 }]; // Deliberate mismatch

    const results = runVerificationChecks({
      vendor: 'VERIFONE',
      day,
      items,
    });

    const c01 = results.find((r) => r.id === 'C01');
    expect(c01?.result).toBe('FAIL');
    expect(c01?.difference).toBe('-5.00');
  });

  it('deliberately yields WARN on reconciliation difference (R2)', () => {
    const day = [
      {
        business_date: '2026-10-15',
        payments_net: 39096.84,
        total_sales_with_tax: 40534.34,
        lottery_payouts: -1435.0, // Expected: 40534.34 - 1435.00 = 39099.34
      },
    ];

    const results = runVerificationChecks({
      vendor: 'VERIFONE',
      day,
    });

    const r2 = results.find((r) => r.id === 'R2');
    expect(r2?.result).toBe('WARN');
    expect(r2?.difference).toBe('-2.50');
    expect(r2?.explanation).toContain('2026-10-15');
  });

  it('yields WARN (truncated) when items array hits 20000 rows', () => {
    const dummyItems = new Array(20000).fill({ net_sales: 1.0 });
    const day = [{ business_date: '2026-10-15', item_sales: 20000.0 }];

    const results = runVerificationChecks({
      vendor: 'VERIFONE',
      day,
      items: dummyItems,
    });

    const c01 = results.find((r) => r.id === 'C01');
    expect(c01?.result).toBe('WARN (truncated)');
  });
  describe('void and refund amounts (C31–C34)', () => {
    const day = [
      { business_date: '2026-10-15', void_line_amount: 114.73, void_amount: 785.4, total_void_amount: 900.13, refund_amount: 12.5 },
      { business_date: '2026-10-16', void_line_amount: 0, void_amount: 0, total_void_amount: 0, refund_amount: 0 },
    ];
    const voids = [{ business_date: '2026-10-15', void_line_amount: 114.73, void_amount: 785.4, total_void_amount: 900.13 }];
    const sd = [{ business_date: '2026-10-15', kind: 'refund', occurrences: 1, amount: -12.5 }];
    const ids = ['C31', 'C32', 'C33', 'C34'];

    for (const vendor of ['VERIFONE', 'GILBARCO']) {
      it(`passes when day amounts tie to voids and suspicious daily (${vendor})`, () => {
        const results = runVerificationChecks({ vendor, day, voids, sd });
        for (const id of ids) {
          expect(results.find((r) => r.id === id)?.result, id).toBe('PASS');
        }
        expect(results.find((r) => r.id === 'C31')?.left).toBe('900.13');
        expect(results.find((r) => r.id === 'C34')?.right).toBe('12.50');
      });
    }

    it('fails each check on a one-cent difference', () => {
      const off = [{ ...day[0], void_line_amount: 114.74, void_amount: 785.39, total_void_amount: 900.14, refund_amount: 12.49 }];
      const results = runVerificationChecks({ vendor: 'GILBARCO', day: off, voids, sd });
      expect(results.find((r) => r.id === 'C31')).toMatchObject({ result: 'FAIL', difference: '0.01' });
      expect(results.find((r) => r.id === 'C32')).toMatchObject({ result: 'FAIL', difference: '0.01' });
      expect(results.find((r) => r.id === 'C33')).toMatchObject({ result: 'FAIL', difference: '-0.01' });
      expect(results.find((r) => r.id === 'C34')).toMatchObject({ result: 'FAIL', difference: '-0.01' });
    });

    it('is NO DATA when no day, voids or suspicious rows were loaded', () => {
      const results = runVerificationChecks({ vendor: 'VERIFONE' });
      for (const id of ids) {
        expect(results.find((r) => r.id === id)?.result, id).toBe('NO DATA');
      }
    });
  });

  it('D5 also compares voidAmount to the day total_void_amount', () => {
    const base = {
      vendor: 'GILBARCO',
      voids: [{ business_date: '2026-10-15', void_lines: 36, total_void_amount: 205.64 }],
      dr: { records: [{ reportDate: '2026-10-15', lineVoid: 36, voidAmount: 205.64 }] },
    };
    const pass = runVerificationChecks({ ...base, day: [{ business_date: '2026-10-15', total_void_amount: 205.64 }] });
    expect(pass.find((r) => r.id === 'D0–D7')?.result).toBe('PASS');

    const fail = runVerificationChecks({ ...base, day: [{ business_date: '2026-10-15', total_void_amount: 201.65 }] });
    const d = fail.find((r) => r.id === 'D0–D7');
    expect(d?.result).toBe('FAIL');
    expect(d?.explanation).toContain('day total_void_amount 201.65');
  });
});

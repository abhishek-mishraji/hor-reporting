import { describe, it, expect } from 'vitest';
import { groupByLotteryDepartment } from '../src/pages/LotteryPage.jsx';

const row = (business_date, dept_number, dept_name, sales_class, net_sales) =>
  ({ business_date, dept_number, dept_name, sales_class, net_sales });

describe('groupByLotteryDepartment', () => {
  it('splits Wolf lottery into scratch-off, online and payouts, sales first', () => {
    const groups = groupByLotteryDepartment([
      row('2026-10-02', 6, 'LOTTO PAID OUT', 'lottery_payout', -50),
      row('2026-10-02', 57, 'LOTTO ONLINE', 'lottery_sale', 40),
      row('2026-10-01', 5, 'LOTTO SCRATCH OFF', 'lottery_sale', 100),
      row('2026-10-02', 5, 'LOTTO SCRATCH OFF', 'lottery_sale', 60),
      row('2026-10-01', 1, 'GROCERY', 'merchandise', 999),
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      'LOTTO ONLINE (#57)',
      'LOTTO SCRATCH OFF (#5)',
      'LOTTO PAID OUT (#6)',
    ]);
    expect(groups[1].rows.map((r) => r.business_date)).toEqual(['2026-10-01', '2026-10-02']);
  });

  it('gives a single sales section for a store with one Lotto department', () => {
    const groups = groupByLotteryDepartment([
      row('2026-10-01', 29, 'Lotto', 'lottery_sale', 1438.52),
      row('2026-10-01', 28, 'Lotto Payout', 'lottery_payout', -1239),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Lotto (#29)', 'Lotto Payout (#28)']);
  });
});

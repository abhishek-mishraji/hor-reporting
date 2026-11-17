import { describe, it, expect } from 'vitest';
import { initialDraft, draftChanges } from '../src/ui/LotteryEditBlock.jsx';
import { LOTTERY_FIELDS } from '../src/pages/DailyReportPage.jsx';

const fields = {
  scratch_sales: { pos: '655.00', value: '655.00', edited: false },
  scratch_tickets: { pos: 257, value: 260, edited: true },
  commission: { pos: '0.00', value: '45.60', edited: true },
  settlement: { pos: '0.00', value: '0.00', edited: false },
};
const rows = [{ key: 'scratch_sales', countKey: 'scratch_tickets' }, { key: 'commission' }, { key: 'settlement' }];

describe('initialDraft', () => {
  it('starts entered fields with their value and POS fields empty', () => {
    expect(initialDraft(rows, fields)).toEqual({
      scratch_sales: '',
      scratch_tickets: '260',
      commission: '45.60',
      settlement: '',
    });
  });
});

describe('draftChanges', () => {
  it('sends only real changes; empty = back to the POS figure', () => {
    const { values, errors } = draftChanges(
      { scratch_sales: '700', scratch_tickets: '', commission: '45.60', settlement: '-12.5' },
      fields,
      LOTTERY_FIELDS,
    );
    expect(errors).toEqual({});
    expect(values).toEqual({ scratch_sales: 700, scratch_tickets: null, settlement: -12.5 });
  });

  it('does not send anything when nothing changed', () => {
    expect(draftChanges(initialDraft(rows, fields), fields, LOTTERY_FIELDS).values).toEqual({});
  });

  it('rejects bad amounts and ticket counts', () => {
    const { values, errors } = draftChanges(
      { scratch_sales: '1.005', scratch_tickets: '2.5', commission: 'abc', settlement: '' },
      fields,
      LOTTERY_FIELDS,
    );
    expect(Object.keys(errors).sort()).toEqual(['commission', 'scratch_sales', 'scratch_tickets']);
    expect(values).toEqual({});
  });
});

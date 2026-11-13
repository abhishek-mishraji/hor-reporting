import { describe, it, expect } from 'vitest';
import { voidItemRows, filterVoidItems, summarizeVoidItems, isLineVoid } from '../src/voidItems.js';
import { toCsv } from '../src/csv.js';

const events = [
  { business_date: '2026-10-15', occurred_at: '2026-10-15T14:00:00', kind: 'void', amount: 10.5, item: 'COKE, CHIPS' },
  { business_date: '2026-10-15', occurred_at: '2026-10-15T09:00:00', kind: 'void_line', amount: -2.49, item: 'COKE' },
  { business_date: '2026-09-08', occurred_at: '2026-09-08T11:05:22', kind: 'no_sale', amount: null },
  { business_date: '2026-09-08', occurred_at: '2026-09-08T11:00:00', kind: 'refund', amount: -4 },
  { business_date: '2026-09-08', occurred_at: '2026-09-08T12:00:00', kind: 'void_line_in_prepay_deposit', amount: 3 },
  { business_date: '2026-09-08', occurred_at: '2026-09-08T13:00:00', kind: 'void_line', amount: null, item: 'DEPT 1' },
];

describe('voidItemRows', () => {
  it('keeps the Verifone void kinds, sorted by date then time, amounts positive', () => {
    const rows = voidItemRows(events, 'VERIFONE');
    expect(rows.map((r) => [r.business_date, r.kind, r.amount])).toEqual([
      ['2026-09-08', 'void_line', null],
      ['2026-10-15', 'void_line', 2.49],
      ['2026-10-15', 'void', 10.5],
    ]);
  });

  it('adds the Gilbarco-only line void kinds', () => {
    expect(voidItemRows(events, 'GILBARCO').map((r) => r.kind)).toEqual([
      'void_line_in_prepay_deposit',
      'void_line',
      'void_line',
      'void',
    ]);
  });

  it('keeps a void that really is negative negative, so totals match the voids report', () => {
    const g = voidItemRows([{ business_date: '2026-10-19', kind: 'void', amount: -0.01 }], 'GILBARCO');
    expect(g[0].amount).toBe(-0.01);
  });

  it('does not change the fetched rows', () => {
    const copy = structuredClone(events);
    voidItemRows(events, 'VERIFONE');
    expect(events).toEqual(copy);
  });

  it('handles a missing response', () => {
    expect(voidItemRows(null, 'VERIFONE')).toEqual([]);
  });
});

describe('filterVoidItems and summarizeVoidItems', () => {
  const rows = voidItemRows(events, 'GILBARCO');

  it('splits line voids (every void_line kind) from transaction voids', () => {
    expect(isLineVoid('void_line_in_voided_transaction')).toBe(true);
    expect(isLineVoid('void')).toBe(false);
    expect(filterVoidItems(rows, { type: 'line' }).map((r) => r.kind)).toEqual([
      'void_line_in_prepay_deposit',
      'void_line',
      'void_line',
    ]);
    expect(filterVoidItems(rows, { type: 'transaction' }).map((r) => r.kind)).toEqual(['void']);
    expect(filterVoidItems(rows, {})).toHaveLength(4);
  });

  it('filters to one date', () => {
    expect(filterVoidItems(rows, { date: '2026-10-15' }).map((r) => r.kind)).toEqual(['void_line', 'void']);
  });

  it('sums counts and amounts in cents, empty amounts as 0', () => {
    expect(summarizeVoidItems(voidItemRows(events, 'VERIFONE'))).toEqual({
      lineCount: 2,
      lineCents: 249,
      voidCount: 1,
      voidCents: 1050,
    });
  });
});

describe('toCsv', () => {
  it('writes a BOM, label headers, raw values, CRLF and quotes like the service CSV', () => {
    const cols = [
      { key: 'business_date', label: 'Date', type: 'date' },
      { key: 'kind', label: 'Void type', type: 'label', labels: { void: 'Transaction void' } },
      { key: 'item', label: 'Product(s)', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'money' },
    ];
    const csv = toCsv(cols, [
      { business_date: '2026-10-15', kind: 'void', item: 'COKE, "DIET"', amount: 10.5 },
      { business_date: '2026-10-15', kind: 'void_line', item: null, amount: null },
    ]);
    expect(csv).toBe(
      '﻿Date,Void type,Product(s),Amount\r\n' +
        '2026-10-15,Transaction void,"COKE, ""DIET""",10.5\r\n' +
        '2026-10-15,void_line,,\r\n'
    );
  });
});

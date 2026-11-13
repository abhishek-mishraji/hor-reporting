/**
 * @file voidItems.js
 * The "Voided items" list on the Suspicious page: suspicious events of the void kinds only (docs/03).
 * V: one void_line row per voided line. G: one void_line* row per transaction, products joined in `item`.
 */
import { sumCents } from './num.js';

export const VOID_KINDS = {
  VERIFONE: ['void_line', 'void'],
  GILBARCO: ['void_line', 'void', 'void_line_in_prepay_deposit', 'void_line_in_voided_transaction'],
};

/** Void type filter values: '' = all, 'line' = every void_line* kind, 'transaction' = void. */
export function isLineVoid(kind) {
  return String(kind || '').startsWith('void_line');
}

/**
 * Void rows of the fetched events, sorted by date then time, with amounts shown positive.
 * Only V line voids come back negative (docs/03 sign cheat-sheet), so only those are flipped: a void that
 * really is negative (G has a −0.01 transaction void) stays negative and the totals still match the voids report.
 * The fetched rows are not changed.
 * @param {Array<object>} events
 * @param {string} vendor 'VERIFONE' | 'GILBARCO'
 * @returns {Array<object>}
 */
export function voidItemRows(events, vendor) {
  const isV = String(vendor || '').toUpperCase() !== 'GILBARCO';
  const kinds = new Set(isV ? VOID_KINDS.VERIFONE : VOID_KINDS.GILBARCO);
  return (events || [])
    .filter((row) => kinds.has(row.kind))
    .map((row) =>
      isV && row.kind === 'void_line' && row.amount != null ? { ...row, amount: -Number(row.amount) } : { ...row }
    )
    .sort(
      (a, b) =>
        String(a.business_date ?? '').localeCompare(String(b.business_date ?? '')) ||
        String(a.occurred_at ?? '').localeCompare(String(b.occurred_at ?? ''))
    );
}

/**
 * @param {Array<object>} rows output of voidItemRows
 * @param {{ type?: ''|'line'|'transaction', date?: string }} filter
 */
export function filterVoidItems(rows, { type = '', date = '' } = {}) {
  return rows.filter(
    (row) =>
      (!type || (type === 'line') === isLineVoid(row.kind)) && (!date || row.business_date === date)
  );
}

/**
 * Counts and amounts (integer cents) of line voids and transaction voids in the rows.
 * @param {Array<object>} rows
 */
export function summarizeVoidItems(rows) {
  const lines = rows.filter((row) => isLineVoid(row.kind));
  const txns = rows.filter((row) => row.kind === 'void');
  return {
    lineCount: lines.length,
    lineCents: sumCents(lines, 'amount'),
    voidCount: txns.length,
    voidCents: sumCents(txns, 'amount'),
  };
}

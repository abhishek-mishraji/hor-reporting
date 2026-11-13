/**
 * @file format.js
 * Display formatting for report cells. Values are shown exactly as the server sent them,
 * only dressed up: no time-zone conversion, no rounding beyond the field's own precision.
 */

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const gallonsFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const priceFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 3, maximumFractionDigits: 3 });
const countFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

function isBlank(v) {
  return v === null || v === undefined || v === '';
}

/**
 * Formats "HH:MM[:SS]" (or the time part of "YYYY-MM-DDTHH:MM:SS") as "h:mm AM".
 * The server already sends store-local time, so the clock is read as-is.
 */
function formatTime(v) {
  const m = /(\d{2}):(\d{2})/.exec(String(v).split('T').pop());
  if (!m) return String(v);
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Formats "YYYY-MM-DD" as "Oct 24, 2026" without going through Date (no time-zone shift).
 */
function formatDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (!m) return String(v);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1];
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

/**
 * Formats a value for display according to its column type.
 * A missing value is shown blank, never as 0.
 * @param {any} v
 * @param {'money'|'gallons'|'price'|'count'|'number'|'date'|'time'|'text'|'label'} type
 * @param {Record<string,string>} [labels] value-to-label map for type 'label'
 * @returns {string}
 */
export function formatCell(v, type, labels) {
  if (isBlank(v)) return '';
  const n = Number(v);
  switch (type) {
    case 'money':
      return Number.isNaN(n) ? String(v) : moneyFmt.format(n);
    case 'gallons':
      return Number.isNaN(n) ? String(v) : gallonsFmt.format(n);
    case 'price':
      return Number.isNaN(n) ? String(v) : priceFmt.format(n);
    case 'count':
      return Number.isNaN(n) ? String(v) : countFmt.format(n);
    case 'date':
      return formatDate(v);
    case 'time':
      return formatTime(v);
    case 'label':
      return labels?.[v] ?? String(v);
    default:
      return typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
  }
}

/** Column types whose values add up into a subtotal / total row. */
export const SUMMABLE_TYPES = new Set(['money', 'gallons', 'count']);

/** Column types right-aligned in tables. */
export const NUMERIC_TYPES = new Set(['money', 'gallons', 'price', 'count', 'number']);

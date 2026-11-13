/**
 * @file num.js
 * Numeric parsing, sums, and rounding utilities following docs/05 section 1.
 * All financial arithmetic uses integer cents and fuel uses integer thousandths to prevent floating point drift.
 */

/**
 * Columns that should NOT be summed in the table totals row (docs/04 rule 3).
 */
export const NON_ADDITIVE_COLUMNS = new Set([
  'store_id',
  'dept_number',
  'register',
  'ticket_number',
  'file_id',
  'ticket_seq',
  'line_no',
  'fuel_grade_id',
  'duration_sec',
  'avg_price',
  'days',
  'tax_rate',
  'pos_num',
  'tr_seq',
]);

/**
 * Checks if a column name is non-additive.
 * @param {string} colName
 * @returns {boolean}
 */
export function isNonAdditiveColumn(colName) {
  if (!colName) return true;
  return NON_ADDITIVE_COLUMNS.has(colName.toLowerCase());
}

/**
 * Converts a dollar amount or number to integer cents.
 * Null/undefined/empty string becomes 0.
 * @param {number|string|null|undefined} v
 * @returns {number} Integer cents
 */
export function toCents(v) {
  if (v === null || v === undefined || v === '') return 0;
  const num = Number(v);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Converts gallons to integer thousandths.
 * Null/undefined/empty string becomes 0.
 * @param {number|string|null|undefined} v
 * @returns {number} Integer thousandths
 */
export function toMilli(v) {
  if (v === null || v === undefined || v === '') return 0;
  const num = Number(v);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 1000);
}

/**
 * Converts integer cents back to a dollar string with 2 decimals.
 * @param {number} cents
 * @returns {string}
 */
export function fromCents(cents) {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return '0.00';
  return (cents / 100).toFixed(2);
}

/**
 * Converts integer thousandths back to a gallons string with 3 decimals.
 * @param {number} milli
 * @returns {string}
 */
export function fromMilli(milli) {
  if (milli === null || milli === undefined || Number.isNaN(milli)) return '0.000';
  return (milli / 1000).toFixed(3);
}

/**
 * Sums a field over an array of objects as integer cents.
 * @param {Array<object>} list
 * @param {string} field
 * @returns {number} Total integer cents
 */
export function sumCents(list, field) {
  if (!Array.isArray(list) || list.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < list.length; i++) {
    const val = list[i]?.[field];
    total += toCents(val);
  }
  return total;
}

/**
 * Sums a field over an array of objects as integer thousandths (gallons).
 * @param {Array<object>} list
 * @param {string} field
 * @returns {number} Total integer thousandths
 */
export function sumMilli(list, field) {
  if (!Array.isArray(list) || list.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < list.length; i++) {
    const val = list[i]?.[field];
    total += toMilli(val);
  }
  return total;
}

/**
 * Sums an integer field over an array of objects.
 * @param {Array<object>} list
 * @param {string} field
 * @returns {number}
 */
export function sumInt(list, field) {
  if (!Array.isArray(list) || list.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < list.length; i++) {
    const val = list[i]?.[field];
    if (val !== null && val !== undefined && val !== '') {
      const n = parseInt(val, 10);
      if (!Number.isNaN(n)) total += n;
    }
  }
  return total;
}

/**
 * Half-up rounding to 2 decimal places.
 * Used for Daily Register checks D1 & D2 (docs/05 section 4).
 * @param {number|string|null|undefined} val
 * @returns {string} Formatted to 2 decimals
 */
export function roundHalfUp2(val) {
  if (val === null || val === undefined || val === '') return '0.00';
  const num = Number(val);
  if (Number.isNaN(num)) return '0.00';
  const sign = num < 0 ? -1 : 1;
  const abs = Math.abs(num);
  const rounded = Math.round((abs + Number.EPSILON) * 100) / 100;
  return (sign * rounded).toFixed(2);
}

/**
 * Checks whether an array of objects has all null/missing values for a given field or set of fields.
 * @param {Array<object>} list
 * @param {string|string[]} fields
 * @returns {boolean}
 */
export function hasNoData(list, fields) {
  if (!Array.isArray(list) || list.length === 0) return true;
  const fieldList = Array.isArray(fields) ? fields : [fields];
  for (const item of list) {
    for (const f of fieldList) {
      if (item && item[f] !== null && item[f] !== undefined && item[f] !== '') {
        return false;
      }
    }
  }
  return true;
}

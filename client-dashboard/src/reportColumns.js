/**
 * @file reportColumns.js
 * The columns a client can see, per report.
 *
 * - A field the server returns that is NOT listed here is never shown (ids, file numbers, tie checks, duplicates).
 * - `show: true` columns are on by default; `show: false` columns can be turned on from the Columns menu.
 * - A column only appears when the server actually returned it (Verifone and Gilbarco differ slightly).
 * - `type` drives formatting and whether the column adds up into totals (see format.js).
 */

const KIND_LABELS = {
  safe_drop: 'Safe drop',
  payout: 'Paid-out',
  safe_loan: 'Safe loan',
  pay_in: 'Pay-in',
  no_sale: 'No sale',
  void_line: 'Line void',
  void: 'Transaction void',
  refund: 'Refund',
  refund_void: 'Refund void',
  void_line_in_prepay_deposit: 'Line void (prepay)',
  void_line_in_voided_transaction: 'Line void (in voided sale)',
};

const ITEM_TYPE_LABELS = {
  scanned: 'Scanned',
  'department ring': 'Department ring',
};

export const SALES_CLASS_LABELS = {
  merchandise: 'Merchandise',
  lottery_sale: 'Lottery sales',
  lottery_payout: 'Lottery payouts',
  fuel: 'Fuel',
  other: 'Other',
};

const SALES_CLASS_ORDER = ['merchandise', 'lottery_sale', 'lottery_payout', 'fuel', 'other'];

/**
 * Splits department rows into sales-class sections (Merchandise, Lottery sales, Lottery payouts, Fuel),
 * so lottery and fuel never add into the merchandise total.
 * @param {Array<object>} rows
 * @param {string} classKey field holding the sales class ('sales_class' or 'salesClass')
 * @returns {Array<{id: string, label: string, rows: Array<object>}>}
 */
export function groupBySalesClass(rows, classKey) {
  const byClass = new Map();
  for (const row of rows || []) {
    const cls = SALES_CLASS_LABELS[row[classKey]] ? row[classKey] : 'other';
    if (!byClass.has(cls)) byClass.set(cls, []);
    byClass.get(cls).push(row);
  }
  return SALES_CLASS_ORDER.filter((cls) => byClass.has(cls)).map((cls) => ({
    id: cls,
    label: SALES_CLASS_LABELS[cls],
    rows: byClass.get(cls),
  }));
}

const date = { key: 'business_date', label: 'Date', type: 'date', show: true };

export const REPORT_COLUMNS = {
  daySummary: [
    date,
    { key: 'customers', label: 'Customers', type: 'count', show: true },
    { key: 'merchandise_net', label: 'Merchandise sales', type: 'money', show: true },
    { key: 'lottery_sales', label: 'Lottery sales', type: 'money', show: true },
    { key: 'lottery_payouts', label: 'Lottery payouts', type: 'money', show: true },
    { key: 'fuel_sales', label: 'Fuel sales', type: 'money', show: true },
    { key: 'fuel_gallons', label: 'Fuel gallons', type: 'gallons', show: true },
    { key: 'tax', label: 'Tax', type: 'money', show: true },
    { key: 'total_sales_with_tax', label: 'Total sales (with tax)', type: 'money', show: true },
    { key: 'total_sales_before_tax', label: 'Total sales (before tax)', type: 'money', show: false },
    { key: 'promotions', label: 'Promotions', type: 'money', show: false },
    { key: 'fuel_net', label: 'Fuel net (after discounts)', type: 'money', show: false },
    { key: 'payments_net', label: 'Payments received', type: 'money', show: false },
    { key: 'pump_sales', label: 'Pump sales', type: 'count', show: false },
    { key: 'prepay_deposits', label: 'Prepay deposits', type: 'count', show: false },
    { key: 'lottery_payout_count', label: 'Lottery payout count', type: 'count', show: false },
    { key: 'safe_drops', label: 'Safe drops', type: 'count', show: false },
    { key: 'safe_drop_amount', label: 'Safe drop amount', type: 'money', show: false },
    { key: 'cash_deposit', label: 'Cash deposit', type: 'money', show: false },
    { key: 'check_deposit', label: 'Check deposit', type: 'money', show: false },
    { key: 'payouts', label: 'Paid-outs', type: 'count', show: false },
    { key: 'payout_amount', label: 'Paid-out amount', type: 'money', show: false },
    { key: 'safe_loans', label: 'Safe loans', type: 'count', show: false },
    { key: 'safe_loan_amount', label: 'Safe loan amount', type: 'money', show: false },
    { key: 'no_sales', label: 'No sales', type: 'count', show: true },
    { key: 'void_lines', label: 'Line voids', type: 'count', show: true },
    { key: 'void_line_amount', label: 'Line void amount', type: 'money', show: false },
    { key: 'voids', label: 'Transaction voids', type: 'count', show: true },
    { key: 'void_amount', label: 'Transaction void amount', type: 'money', show: false },
    { key: 'total_void_amount', label: 'Total void amount', type: 'money', show: true },
    { key: 'refunds', label: 'Refunds', type: 'count', show: true },
    { key: 'refund_amount', label: 'Refund amount', type: 'money', show: true },
    { key: 'refunded_money', label: 'Refunded money', type: 'money', show: false },
    { key: 'refund_voids', label: 'Refund voids', type: 'count', show: false },
    { key: 'shifts', label: 'Shifts', type: 'count', show: false },
  ],

  items: [
    date,
    { key: 'upc', label: 'UPC', type: 'text', show: true },
    { key: 'description', label: 'Description', type: 'text', show: true },
    { key: 'dept_name', label: 'Department', type: 'text', show: false },
    { key: 'item_type', label: 'Item type', type: 'label', labels: ITEM_TYPE_LABELS, show: false },
    { key: 'units_sold', label: 'Units', type: 'count', show: true },
    { key: 'gross_sales', label: 'Gross', type: 'money', show: true },
    { key: 'promotions', label: 'Promotions', type: 'money', show: true },
    { key: 'net_sales', label: 'Net sales', type: 'money', show: true },
    { key: 'tickets', label: 'Tickets', type: 'count', show: false },
    { key: 'days', label: 'Days sold', type: 'number', show: false },
  ],

  departments: [
    date,
    { key: 'dept_number', label: 'Dept #', type: 'text', show: true },
    { key: 'dept_name', label: 'Department', type: 'text', show: true },
    { key: 'units_sold', label: 'Units', type: 'count', show: true },
    { key: 'gross_sales', label: 'Gross', type: 'money', show: true },
    { key: 'promotions', label: 'Promotions', type: 'money', show: true },
    { key: 'discount', label: 'Discount', type: 'money', show: false },
    { key: 'refund', label: 'Refund', type: 'money', show: false },
    { key: 'void_amount', label: 'Void', type: 'money', show: false },
    { key: 'net_sales', label: 'Net sales', type: 'money', show: true },
    { key: 'fuel_gallons', label: 'Fuel gallons', type: 'gallons', show: false },
    { key: 'lines', label: 'Lines sold', type: 'count', show: false },
  ],

  monthly: [
    { key: 'deptCode', label: 'Dept #', type: 'text', show: true },
    { key: 'deptName', label: 'Department', type: 'text', show: true },
    { key: 'gross', label: 'Gross', type: 'money', show: true },
    { key: 'discount', label: 'Discount', type: 'money', show: true },
    { key: 'promotion', label: 'Promotion', type: 'money', show: true },
    { key: 'refund', label: 'Refund', type: 'money', show: true },
    { key: 'voidAmount', label: 'Void', type: 'money', show: true },
    { key: 'netSales', label: 'Net sales', type: 'money', show: true },
  ],

  fuel: [
    date,
    { key: 'fuel_grade', label: 'Grade', type: 'text', show: true },
    { key: 'fuel_price_level', label: 'Price level', type: 'text', show: true },
    { key: 'gallons', label: 'Gallons', type: 'gallons', show: true },
    { key: 'amount', label: 'Sales amount', type: 'money', show: true },
    { key: 'avg_price', label: 'Avg price / gal', type: 'price', show: true },
    { key: 'fuel_sales', label: 'Dispenses', type: 'count', show: false },
    { key: 'ppg_discount', label: 'Discount', type: 'money', show: false },
    { key: 'fuel_discount', label: 'Discount', type: 'money', show: false },
    { key: 'net_amount', label: 'Net amount', type: 'money', show: false },
  ],

  cash: [
    date,
    { key: 'occurred_at', label: 'Time', type: 'time', show: true },
    { key: 'kind', label: 'Type', type: 'label', labels: KIND_LABELS, show: true },
    { key: 'register', label: 'Register', type: 'text', show: true },
    { key: 'cashier', label: 'Cashier', type: 'text', show: true },
    { key: 'amount', label: 'Amount', type: 'money', show: true },
    { key: 'reference', label: 'Reference', type: 'text', show: true },
    { key: 'ticket_number', label: 'Ticket #', type: 'text', show: false },
    { key: 'till', label: 'Till', type: 'text', show: false },
    { key: 'paid_with', label: 'Paid with', type: 'text', show: false },
  ],

  suspiciousDaily: [
    date,
    { key: 'kind', label: 'Type', type: 'label', labels: KIND_LABELS, show: true },
    { key: 'occurrences', label: 'Times', type: 'count', show: true },
    { key: 'amount', label: 'Amount', type: 'money', show: true },
  ],

  voids: [
    date,
    { key: 'total_voids', label: 'Total voids', type: 'count', show: true },
    { key: 'total_void_amount', label: 'Total void amount', type: 'money', show: true },
    { key: 'void_lines', label: 'Line voids', type: 'count', show: false },
    { key: 'void_line_amount', label: 'Line void amount', type: 'money', show: false },
    { key: 'voided_units', label: 'Voided units', type: 'count', show: false },
    { key: 'voids', label: 'Transaction voids', type: 'count', show: false },
    { key: 'void_amount', label: 'Transaction void amount', type: 'money', show: false },
  ],

  // Suspicious events of the void kinds only (Suspicious page, "Voided items"). Amounts are shown positive.
  voidItems: [
    date,
    { key: 'occurred_at', label: 'Time', type: 'time', show: true },
    { key: 'kind', label: 'Void type', type: 'label', labels: KIND_LABELS, show: true },
    { key: 'register', label: 'Register', type: 'text', show: true },
    { key: 'cashier', label: 'Cashier', type: 'text', show: true },
    { key: 'item', label: 'Product(s)', type: 'text', show: true },
    { key: 'quantity', label: 'Qty', type: 'count', show: true },
    { key: 'lines', label: 'Items voided', type: 'count', show: true },
    { key: 'amount', label: 'Amount', type: 'money', show: true },
    { key: 'ticket_number', label: 'Ticket #', type: 'text', show: true },
    { key: 'detail', label: 'Detail', type: 'text', show: false },
    { key: 'duration_sec', label: 'Duration (sec)', type: 'number', show: false },
  ],

  suspiciousEvents: [
    date,
    { key: 'occurred_at', label: 'Time', type: 'time', show: true },
    { key: 'kind', label: 'Type', type: 'label', labels: KIND_LABELS, show: true },
    { key: 'register', label: 'Register', type: 'text', show: true },
    { key: 'cashier', label: 'Cashier', type: 'text', show: true },
    { key: 'amount', label: 'Amount', type: 'money', show: true },
    { key: 'item', label: 'Item', type: 'text', show: true },
    { key: 'quantity', label: 'Quantity', type: 'count', show: false },
    { key: 'ticket_number', label: 'Ticket #', type: 'text', show: false },
    { key: 'duration_sec', label: 'Duration (sec)', type: 'number', show: false },
    { key: 'detail', label: 'Detail', type: 'text', show: false },
    { key: 'lines', label: 'Items voided', type: 'count', show: false },
  ],

  lottery: [
    date,
    { key: 'sales_amount', label: 'Lottery sales', type: 'money', show: true },
    { key: 'payout_amount', label: 'Lottery payouts', type: 'money', show: true },
    { key: 'sales_lines', label: 'Sales lines', type: 'count', show: false },
    { key: 'sales_units', label: 'Tickets sold', type: 'count', show: false },
    { key: 'payouts', label: 'Payout count', type: 'count', show: false },
  ],

  // Lottery split by lottery department (e.g. Wolf: LOTTO SCRATCH OFF, LOTTO ONLINE, LOTTO PAID OUT).
  lotteryDepartments: [
    date,
    { key: 'units_sold', label: 'Tickets', type: 'count', show: true },
    { key: 'net_sales', label: 'Amount', type: 'money', show: true },
    { key: 'lines', label: 'Lines', type: 'count', show: false },
  ],
};

/**
 * Column defaults that changed after users could already save column choices.
 * A choice saved before `version` keeps the old default (`previous`) for these keys;
 * a user with nothing saved gets the current defaults.
 */
export const COLUMN_DEFAULT_CHANGES = {
  daySummary: {
    version: 2,
    previous: {
      no_sales: false,
      void_lines: false,
      voids: false,
      refunds: false,
      total_void_amount: false,
      refund_amount: false,
    },
  },
};

/** Version of a report's saved column choices (part of the storage key). */
export function columnPrefsVersion(reportId) {
  return COLUMN_DEFAULT_CHANGES[reportId]?.version || 1;
}

/**
 * Turns column choices saved before the report's defaults changed into choices for the current defaults,
 * so every column looks the same as before. Only differences from the current defaults are returned.
 * @param {string} reportId
 * @param {Record<string, boolean>} saved differences from the old defaults
 * @returns {Record<string, boolean>}
 */
export function upgradeColumnPrefs(reportId, saved) {
  const change = COLUMN_DEFAULT_CHANGES[reportId];
  if (!saved || typeof saved !== 'object' || Object.keys(saved).length === 0) return {};
  if (!change) return { ...saved };
  const merged = { ...change.previous, ...saved };
  const out = {};
  for (const [key, visible] of Object.entries(merged)) {
    const col = (REPORT_COLUMNS[reportId] || []).find((c) => c.key === key);
    if (!col || visible !== col.show) out[key] = visible;
  }
  return out;
}

/**
 * Columns of a report that the server actually returned, in catalog order.
 * Two catalog entries with the same label (vendor-specific fields) never both appear,
 * because each vendor returns only its own one.
 * @param {string} reportId
 * @param {Array<object>} rows
 */
export function availableColumns(reportId, rows) {
  const present = new Set();
  for (const row of rows || []) {
    if (row && typeof row === 'object') Object.keys(row).forEach((k) => present.add(k));
  }
  return (REPORT_COLUMNS[reportId] || []).filter((c) => present.has(c.key));
}

/**
 * @file definitions.js
 * Verification check metadata and descriptions per docs/05.
 */

export const CHECK_LEVELS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARN: 'WARN',
  INFO: 'INFO',
  NO_DATA: 'NO DATA',
};

export const CHECK_DEFINITIONS = [
  // Definitional checks
  { id: 'C01', vendor: 'BOTH', level: 'FAIL', desc: 'Merchandise item net sales equals day item sales', type: 'money' },
  { id: 'C02', vendor: 'BOTH', level: 'FAIL', desc: 'Department merchandise net sales equals day item sales', type: 'money' },
  { id: 'C03', vendor: 'BOTH', level: 'FAIL', desc: 'Department lottery sale net sales equals day lottery sales', type: 'money' },
  { id: 'C04', vendor: 'BOTH', level: 'FAIL', desc: 'Department lottery payout net sales equals day lottery payouts', type: 'money' },
  { id: 'C05', vendor: 'BOTH', level: 'FAIL', desc: 'Lottery sales amount equals day lottery sales', type: 'money' },
  { id: 'C06', vendor: 'BOTH', level: 'FAIL', desc: 'Lottery payout amount equals negative day lottery payouts', type: 'money' },
  { id: 'C07', vendor: 'BOTH', level: 'FAIL', desc: 'Lottery payout count equals day lottery payout count', type: 'int' },
  { id: 'C08', vendor: 'GILBARCO', level: 'FAIL', desc: 'Fuel report gross amount equals day fuel sales', type: 'money' },
  { id: 'C09', vendor: 'BOTH', level: 'FAIL', desc: 'Fuel report gallons equals day fuel gallons', type: 'gallons' },
  { id: 'C10', vendor: 'BOTH', level: 'FAIL', desc: 'Department fuel gross sales equals day fuel sales', type: 'money' },
  { id: 'C11', vendor: 'BOTH', level: 'FAIL', desc: 'Payments net amount equals day payments net', type: 'money' },
  { id: 'C12', vendor: 'BOTH', level: 'FAIL', desc: 'Safe drop movement count equals day safe drops count', type: 'int' },
  { id: 'C13', vendor: 'BOTH', level: 'FAIL', desc: 'Safe drop movements amount sum equals day safe drop amount', type: 'money' },
  { id: 'C14', vendor: 'BOTH', level: 'FAIL', desc: 'Payout cash movements count & amount equal day payouts', type: 'compound' },
  { id: 'C15', vendor: 'BOTH', level: 'FAIL', desc: 'Safe loan cash movements count & amount equal day safe loans', type: 'compound' },
  { id: 'C16', vendor: 'BOTH', level: 'FAIL', desc: 'Suspicious daily no_sale occurrences equal day no_sales', type: 'int' },
  { id: 'C17', vendor: 'BOTH', level: 'FAIL', desc: 'Suspicious daily void_line occurrences equal day void_lines', type: 'int' },
  { id: 'C18', vendor: 'BOTH', level: 'FAIL', desc: 'Suspicious daily void occurrences equal day voids', type: 'int' },
  { id: 'C19', vendor: 'BOTH', level: 'FAIL', desc: 'Suspicious daily refund occurrences equal day refunds', type: 'int' },
  { id: 'C20', vendor: 'BOTH', level: 'FAIL', desc: 'Voids report void_lines equals day void_lines', type: 'int' },
  { id: 'C21', vendor: 'BOTH', level: 'FAIL', desc: 'Voids report voids equals day voids', type: 'int' },
  { id: 'C22', vendor: 'BOTH', level: 'FAIL', desc: 'Day total sales with tax equals total sales before tax plus tax', type: 'money' },
  { id: 'C23', vendor: 'BOTH', level: 'FAIL', desc: 'All department net sales sum equals total sales before tax plus lottery payouts', type: 'money' },
  { id: 'C24', vendor: 'BOTH', level: 'FAIL', desc: 'Day merchandise_net equals day item_sales', type: 'money' },
  { id: 'C26', vendor: 'BOTH', level: 'FAIL', desc: 'Suspicious events row count equals suspicious daily occurrences per kind', type: 'compound' },
  { id: 'C27', vendor: 'BOTH', level: 'FAIL', desc: 'Lottery payouts report count equals lottery report payouts count', type: 'int' },
  { id: 'C28', vendor: 'BOTH', level: 'FAIL', desc: 'Lottery payouts report amount equals lottery report payout amount', type: 'money' },
  { id: 'C29', vendor: 'BOTH', level: 'FAIL', desc: 'Suspicious daily void amount equals voids report void_amount', type: 'money' },
  { id: 'C30', vendor: 'BOTH', level: 'FAIL', desc: 'Day promotions equals department promotions sum (all classes)', type: 'money' },
  { id: 'C31', vendor: 'BOTH', level: 'FAIL', desc: 'Day total void amount equals voids report total_void_amount', type: 'money' },
  { id: 'C32', vendor: 'BOTH', level: 'FAIL', desc: 'Day line void amount equals voids report void_line_amount', type: 'money' },
  { id: 'C33', vendor: 'BOTH', level: 'FAIL', desc: 'Day transaction void amount equals voids report void_amount', type: 'money' },
  { id: 'C34', vendor: 'BOTH', level: 'FAIL', desc: 'Day refund amount equals negative suspicious daily refund amount', type: 'money' },
  { id: 'V02', vendor: 'VERIFONE', level: 'FAIL', desc: 'Day total sales with tax equals ticket totals minus lottery payouts', type: 'money' },
  { id: 'G01', vendor: 'GILBARCO', level: 'FAIL', desc: 'Fuel net amount sum equals day fuel_net', type: 'money' },
  { id: 'G02', vendor: 'GILBARCO', level: 'FAIL', desc: 'Day total sales before tax equals item sales plus lottery sales plus fuel net', type: 'money' },

  // Daily Register checks
  { id: 'D0-D7', vendor: 'BOTH', level: 'FAIL', desc: 'Daily register records match day-summary, voids, and cash movements for every day', type: 'compound' },

  // Monthly report checks
  { id: 'M1-M3', vendor: 'BOTH', level: 'FAIL', desc: 'Monthly report arithmetic, department sums, and DEPT_M tie', type: 'compound' },

  // Reconciliation checks (WARN)
  { id: 'R1', vendor: 'VERIFONE', level: 'WARN', desc: 'POS overall sales counter ties to counted ticket totals', type: 'money' },
  { id: 'R2', vendor: 'BOTH', level: 'WARN', desc: 'Day net payments equal total sales with tax plus lottery payouts', type: 'money' },
  { id: 'R3', vendor: 'GILBARCO', level: 'WARN', desc: 'No payment gaps recorded in range', type: 'int' },
  { id: 'R4', vendor: 'VERIFONE', level: 'WARN', desc: 'Cash and check deposits equal safe drop amount', type: 'money' },

  // Explained differences (INFO)
  { id: 'I1', vendor: 'VERIFONE', level: 'INFO', desc: 'Fuel report pumped fuel vs day fuel_sales (fuel dept lines)', type: 'money' },
];

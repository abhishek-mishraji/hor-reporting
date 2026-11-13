/**
 * @file runChecks.js
 * Implements the cross-verification checks defined in docs/05.
 * Evaluates definitional (FAIL), reconciliation (WARN), and explained difference (INFO) checks.
 */

import {
  toCents,
  fromCents,
  fromMilli,
  sumCents,
  sumMilli,
  sumInt,
  roundHalfUp2,
} from '../num.js';

/**
 * Runs all verification checks for a given store dataset.
 * @param {object} params
 * @param {'VERIFONE'|'GILBARCO'} params.vendor
 * @param {Array<object>} params.day - DAY summary rows
 * @param {Array<object>} params.items - ITEMS sold rows
 * @param {Array<object>} params.dept - DEPT rows
 * @param {Array<object>} params.fuel - FUEL rows
 * @param {Array<object>} params.pay - PAY rows
 * @param {Array<object>} params.cash - CASH movements rows
 * @param {Array<object>} params.sd - Suspicious daily summary rows
 * @param {Array<object>} params.se - Suspicious events rows
 * @param {Array<object>} params.voids - Voids summary rows
 * @param {Array<object>} params.lot - Lottery rows
 * @param {Array<object>} params.lotp - Lottery payouts rows
 * @param {object} params.dr - Daily register object { records: [] }
 * @param {object} params.mon - Monthly departments object { departments: [], totals: {} }
 * @param {Array<object>} params.deptM - Departments for the full month of 'to'
 * @param {Array<object>} [params.gaps] - Payment gaps rows (Gilbarco only)
 * @returns {Array<{ id: string, description: string, left: string, right: string, difference: string, result: 'PASS'|'FAIL'|'WARN'|'INFO'|'NO DATA'|'WARN (truncated)', explanation: string }>}
 */
export function runVerificationChecks({
  vendor,
  day = [],
  items = [],
  dept = [],
  fuel = [],
  pay = [],
  cash = [],
  sd = [],
  se = [],
  voids = [],
  lot = [],
  lotp = [],
  dr = { records: [] },
  drError = null,
  mon = { departments: [], totals: {} },
  deptM = [],
  gaps = [],
}) {
  const isV = String(vendor || '').toUpperCase() === 'VERIFONE';
  const isG = String(vendor || '').toUpperCase() === 'GILBARCO';

  const itemsTruncated = items.length === 20000;
  const seTruncated = se.length === 20000;

  const checks = [];

  // Helper for money check
  function checkMoney(id, desc, leftCents, rightCents, hasInput, isTruncated = false, infoExp = '') {
    if (!hasInput) {
      checks.push({
        id,
        description: desc,
        left: '—',
        right: '—',
        difference: '0.00',
        result: 'NO DATA',
        explanation: 'No loaded POS data found for this check in range.',
      });
      return;
    }

    const diffCents = leftCents - rightCents;
    const leftStr = fromCents(leftCents);
    const rightStr = fromCents(rightCents);
    const diffStr = fromCents(diffCents);

    if (isTruncated) {
      checks.push({
        id,
        description: desc,
        left: leftStr,
        right: rightStr,
        difference: diffStr,
        result: 'WARN (truncated)',
        explanation: 'Result may be truncated due to 20000 row API limit cap.',
      });
      return;
    }

    const pass = diffCents === 0;
    checks.push({
      id,
      description: desc,
      left: leftStr,
      right: rightStr,
      difference: diffStr,
      result: pass ? 'PASS' : 'FAIL',
      explanation: pass ? '' : (infoExp || `Difference: ${diffStr}`),
    });
  }

  // Helper for integer count check
  function checkInt(id, desc, leftCount, rightCount, hasInput, isTruncated = false, infoExp = '') {
    if (!hasInput) {
      checks.push({
        id,
        description: desc,
        left: '—',
        right: '—',
        difference: '0',
        result: 'NO DATA',
        explanation: 'No loaded POS data found for this check in range.',
      });
      return;
    }

    const diff = leftCount - rightCount;
    if (isTruncated) {
      checks.push({
        id,
        description: desc,
        left: String(leftCount),
        right: String(rightCount),
        difference: String(diff),
        result: 'WARN (truncated)',
        explanation: 'Result may be truncated due to 20000 row API limit cap.',
      });
      return;
    }

    const pass = diff === 0;
    checks.push({
      id,
      description: desc,
      left: String(leftCount),
      right: String(rightCount),
      difference: String(diff),
      result: pass ? 'PASS' : 'FAIL',
      explanation: pass ? '' : (infoExp || `Difference: ${diff}`),
    });
  }

  const hasAnyDayData = day.length > 0;

  // C01: ITEMS.net_sales vs DAY.item_sales
  checkMoney(
    'C01',
    'Σ ITEMS.net_sales = Σ DAY.item_sales',
    sumCents(items, 'net_sales'),
    sumCents(day, 'item_sales'),
    hasAnyDayData || items.length > 0,
    itemsTruncated
  );

  // C02: DEPT[merchandise].net_sales vs DAY.item_sales
  const deptMerch = dept.filter((r) => r.sales_class === 'merchandise');
  checkMoney(
    'C02',
    'Σ DEPT[merchandise].net_sales = Σ DAY.item_sales',
    sumCents(deptMerch, 'net_sales'),
    sumCents(day, 'item_sales'),
    hasAnyDayData || dept.length > 0
  );

  // C03: DEPT[lottery_sale].net_sales vs DAY.lottery_sales
  const deptLotSale = dept.filter((r) => r.sales_class === 'lottery_sale');
  checkMoney(
    'C03',
    'Σ DEPT[lottery_sale].net_sales = Σ DAY.lottery_sales',
    sumCents(deptLotSale, 'net_sales'),
    sumCents(day, 'lottery_sales'),
    hasAnyDayData || dept.length > 0
  );

  // C04: DEPT[lottery_payout].net_sales vs DAY.lottery_payouts (both negative)
  const deptLotPay = dept.filter((r) => r.sales_class === 'lottery_payout');
  checkMoney(
    'C04',
    'Σ DEPT[lottery_payout].net_sales = Σ DAY.lottery_payouts',
    sumCents(deptLotPay, 'net_sales'),
    sumCents(day, 'lottery_payouts'),
    hasAnyDayData || dept.length > 0
  );

  // C05: LOT.sales_amount vs DAY.lottery_sales
  checkMoney(
    'C05',
    'Σ LOT.sales_amount = Σ DAY.lottery_sales',
    sumCents(lot, 'sales_amount'),
    sumCents(day, 'lottery_sales'),
    hasAnyDayData || lot.length > 0
  );

  // C06: LOT.payout_amount vs - Σ DAY.lottery_payouts
  checkMoney(
    'C06',
    'Σ LOT.payout_amount = − Σ DAY.lottery_payouts',
    sumCents(lot, 'payout_amount'),
    -sumCents(day, 'lottery_payouts'),
    hasAnyDayData || lot.length > 0
  );

  // C07: LOT.payouts vs DAY.lottery_payout_count
  checkInt(
    'C07',
    'Σ LOT.payouts = Σ DAY.lottery_payout_count',
    sumInt(lot, 'payouts'),
    sumInt(day, 'lottery_payout_count'),
    hasAnyDayData || lot.length > 0
  );

  // C08 (G only): FUEL.amount vs DAY.fuel_sales
  if (isG) {
    checkMoney(
      'C08',
      'Σ FUEL.amount = Σ DAY.fuel_sales',
      sumCents(fuel, 'amount'),
      sumCents(day, 'fuel_sales'),
      hasAnyDayData || fuel.length > 0
    );
  }

  // C09: FUEL.gallons vs DAY.fuel_gallons (thousandths)
  {
    const hasFuelData = hasAnyDayData || fuel.length > 0;
    if (!hasFuelData) {
      checks.push({
        id: 'C09',
        description: 'Σ FUEL.gallons = Σ DAY.fuel_gallons',
        left: '—',
        right: '—',
        difference: '0.000',
        result: 'NO DATA',
        explanation: 'No loaded POS data found for this check in range.',
      });
    } else {
      const leftMilli = sumMilli(fuel, 'gallons');
      const rightMilli = sumMilli(day, 'fuel_gallons');
      const diffMilli = leftMilli - rightMilli;
      const pass = diffMilli === 0;
      checks.push({
        id: 'C09',
        description: 'Σ FUEL.gallons = Σ DAY.fuel_gallons',
        left: fromMilli(leftMilli),
        right: fromMilli(rightMilli),
        difference: fromMilli(diffMilli),
        result: pass ? 'PASS' : 'FAIL',
        explanation: pass ? '' : `Difference: ${fromMilli(diffMilli)} gallons`,
      });
    }
  }

  // C10: DEPT[fuel].gross_sales vs DAY.fuel_sales
  const deptFuel = dept.filter((r) => r.sales_class === 'fuel');
  checkMoney(
    'C10',
    'Σ DEPT[fuel].gross_sales = Σ DAY.fuel_sales',
    sumCents(deptFuel, 'gross_sales'),
    sumCents(day, 'fuel_sales'),
    hasAnyDayData || dept.length > 0
  );

  // C11: PAY.net_amount vs DAY.payments_net
  checkMoney(
    'C11',
    'Σ PAY.net_amount = Σ DAY.payments_net',
    sumCents(pay, 'net_amount'),
    sumCents(day, 'payments_net'),
    hasAnyDayData || pay.length > 0
  );

  // C12: count CASH where kind=safe_drop vs DAY.safe_drops
  const safeDrops = cash.filter((r) => r.kind === 'safe_drop');
  checkInt(
    'C12',
    'count CASH(safe_drop) = Σ DAY.safe_drops',
    safeDrops.length,
    sumInt(day, 'safe_drops'),
    hasAnyDayData || cash.length > 0
  );

  // C13: Σ CASH.amount where kind=safe_drop vs DAY.safe_drop_amount
  checkMoney(
    'C13',
    'Σ CASH.amount(safe_drop) = Σ DAY.safe_drop_amount',
    sumCents(safeDrops, 'amount'),
    sumCents(day, 'safe_drop_amount'),
    hasAnyDayData || cash.length > 0
  );

  // C14: count / Σ amount CASH where kind=payout vs DAY.payouts / DAY.payout_amount
  {
    const payouts = cash.filter((r) => r.kind === 'payout');
    const hasData = hasAnyDayData || cash.length > 0;
    if (!hasData) {
      checks.push({
        id: 'C14',
        description: 'count / Σ amount of CASH(payout) = Σ DAY.payouts / payout_amount',
        left: '—',
        right: '—',
        difference: '0 / 0.00',
        result: 'NO DATA',
        explanation: 'No loaded POS data found for this check in range.',
      });
    } else {
      const leftCount = payouts.length;
      const rightCount = sumInt(day, 'payouts');
      const leftCents = sumCents(payouts, 'amount');
      const rightCents = sumCents(day, 'payout_amount');

      const pass = leftCount === rightCount && leftCents === rightCents;
      checks.push({
        id: 'C14',
        description: 'count / Σ amount of CASH(payout) = Σ DAY.payouts / payout_amount',
        left: `${leftCount} / ${fromCents(leftCents)}`,
        right: `${rightCount} / ${fromCents(rightCents)}`,
        difference: `${leftCount - rightCount} / ${fromCents(leftCents - rightCents)}`,
        result: pass ? 'PASS' : 'FAIL',
        explanation: pass ? '' : 'Mismatch in payout count or total payout amount',
      });
    }
  }

  // C15: count / Σ amount CASH where kind=safe_loan vs DAY.safe_loans / DAY.safe_loan_amount
  {
    const loans = cash.filter((r) => r.kind === 'safe_loan');
    const hasData = hasAnyDayData || cash.length > 0;
    if (!hasData) {
      checks.push({
        id: 'C15',
        description: 'count / Σ amount of CASH(safe_loan) = Σ DAY.safe_loans / safe_loan_amount',
        left: '—',
        right: '—',
        difference: '0 / 0.00',
        result: 'NO DATA',
        explanation: 'No loaded POS data found for this check in range.',
      });
    } else {
      const leftCount = loans.length;
      const rightCount = sumInt(day, 'safe_loans');
      const leftCents = sumCents(loans, 'amount');
      const rightCents = sumCents(day, 'safe_loan_amount');

      const pass = leftCount === rightCount && leftCents === rightCents;
      checks.push({
        id: 'C15',
        description: 'count / Σ amount of CASH(safe_loan) = Σ DAY.safe_loans / safe_loan_amount',
        left: `${leftCount} / ${fromCents(leftCents)}`,
        right: `${rightCount} / ${fromCents(rightCents)}`,
        difference: `${leftCount - rightCount} / ${fromCents(leftCents - rightCents)}`,
        result: pass ? 'PASS' : 'FAIL',
        explanation: pass ? '' : 'Mismatch in safe loan count or amount',
      });
    }
  }

  // C16: SD(no_sale).occurrences vs DAY.no_sales
  const sdNoSale = sd.filter((r) => r.kind === 'no_sale');
  checkInt(
    'C16',
    'Σ SD.occurrences(no_sale) = Σ DAY.no_sales',
    sumInt(sdNoSale, 'occurrences'),
    sumInt(day, 'no_sales'),
    hasAnyDayData || sd.length > 0
  );

  // C17: SD(void_line).occurrences vs DAY.void_lines
  const sdVoidLine = sd.filter((r) => r.kind === 'void_line');
  checkInt(
    'C17',
    'Σ SD.occurrences(void_line) = Σ DAY.void_lines',
    sumInt(sdVoidLine, 'occurrences'),
    sumInt(day, 'void_lines'),
    hasAnyDayData || sd.length > 0
  );

  // C18: SD(void).occurrences vs DAY.voids
  const sdVoid = sd.filter((r) => r.kind === 'void');
  checkInt(
    'C18',
    'Σ SD.occurrences(void) = Σ DAY.voids',
    sumInt(sdVoid, 'occurrences'),
    sumInt(day, 'voids'),
    hasAnyDayData || sd.length > 0
  );

  // C19: SD(refund).occurrences vs DAY.refunds
  const sdRefund = sd.filter((r) => r.kind === 'refund');
  checkInt(
    'C19',
    'Σ SD.occurrences(refund) = Σ DAY.refunds',
    sumInt(sdRefund, 'occurrences'),
    sumInt(day, 'refunds'),
    hasAnyDayData || sd.length > 0
  );

  // C20: VOIDS.void_lines vs DAY.void_lines
  checkInt(
    'C20',
    'Σ VOIDS.void_lines = Σ DAY.void_lines',
    sumInt(voids, 'void_lines'),
    sumInt(day, 'void_lines'),
    hasAnyDayData || voids.length > 0
  );

  // C21: VOIDS.voids vs DAY.voids
  checkInt(
    'C21',
    'Σ VOIDS.voids = Σ DAY.voids',
    sumInt(voids, 'voids'),
    sumInt(day, 'voids'),
    hasAnyDayData || voids.length > 0
  );

  // C22: DAY.total_sales_with_tax = DAY.total_sales_before_tax + DAY.tax
  checkMoney(
    'C22',
    'Σ DAY.total_sales_with_tax = Σ DAY.total_sales_before_tax + Σ DAY.tax',
    sumCents(day, 'total_sales_with_tax'),
    sumCents(day, 'total_sales_before_tax') + sumCents(day, 'tax'),
    hasAnyDayData
  );

  // C23: Σ DEPT.net_sales (all classes) = Σ DAY.total_sales_before_tax + Σ DAY.lottery_payouts
  checkMoney(
    'C23',
    'Σ DEPT.net_sales (all) = Σ DAY.total_sales_before_tax + Σ DAY.lottery_payouts',
    sumCents(dept, 'net_sales'),
    sumCents(day, 'total_sales_before_tax') + sumCents(day, 'lottery_payouts'),
    hasAnyDayData || dept.length > 0
  );

  // C24: DAY.merchandise_net = DAY.item_sales
  checkMoney(
    'C24',
    'Σ DAY.merchandise_net = Σ DAY.item_sales',
    sumCents(day, 'merchandise_net'),
    sumCents(day, 'item_sales'),
    hasAnyDayData
  );

  // C26: SE row count vs SD occurrences per kind
  {
    const targetKinds = isV
      ? ['no_sale', 'void_line', 'void', 'refund', 'refund_void']
      : ['no_sale', 'void_line', 'void', 'refund'];

    let allMatch = true;
    const leftParts = [];
    const rightParts = [];
    let hasData = false;

    for (const k of targetKinds) {
      const seCount = se.filter((r) => r.kind === k).length;
      const sdOccurrences = sumInt(sd.filter((r) => r.kind === k), 'occurrences');
      if (seCount > 0 || sdOccurrences > 0) {
        hasData = true;
        leftParts.push(`${k} ${seCount}`);
        rightParts.push(`${k} ${sdOccurrences}`);
        if (seCount !== sdOccurrences) {
          allMatch = false;
        }
      }
    }

    if (!hasData && !hasAnyDayData && se.length === 0 && sd.length === 0) {
      checks.push({
        id: 'C26',
        description: 'SE row count = SD.occurrences per kind',
        left: '—',
        right: '—',
        difference: '0',
        result: 'NO DATA',
        explanation: 'No suspicious events found.',
      });
    } else if (seTruncated) {
      checks.push({
        id: 'C26',
        description: 'SE row count = SD.occurrences per kind',
        left: leftParts.join(', ') || '0',
        right: rightParts.join(', ') || '0',
        difference: '—',
        result: 'WARN (truncated)',
        explanation: 'SE row count hit the 20000 API cap.',
      });
    } else {
      checks.push({
        id: 'C26',
        description: 'SE row count = SD.occurrences per kind',
        left: leftParts.join(', ') || 'none',
        right: rightParts.join(', ') || 'none',
        difference: allMatch ? '0' : 'mismatch',
        result: allMatch ? 'PASS' : 'FAIL',
        explanation: allMatch ? '' : 'Mismatch between event rows and daily occurrences',
      });
    }
  }

  // C27: LOTP.payouts = LOT.payouts
  checkInt(
    'C27',
    'Σ LOTP.payouts = Σ LOT.payouts',
    sumInt(lotp, 'payouts'),
    sumInt(lot, 'payouts'),
    hasAnyDayData || lot.length > 0 || lotp.length > 0
  );

  // C28: LOTP.payout_amount = LOT.payout_amount
  checkMoney(
    'C28',
    'Σ LOTP.payout_amount = Σ LOT.payout_amount',
    sumCents(lotp, 'payout_amount'),
    sumCents(lot, 'payout_amount'),
    hasAnyDayData || lot.length > 0 || lotp.length > 0
  );

  // C29: SD(void).amount = VOIDS.void_amount
  checkMoney(
    'C29',
    'Σ SD.amount(void) = Σ VOIDS.void_amount',
    sumCents(sd.filter((r) => r.kind === 'void'), 'amount'),
    sumCents(voids, 'void_amount'),
    hasAnyDayData || sd.length > 0 || voids.length > 0
  );

  // C30: DAY.promotions = DEPT.promotions (all classes)
  checkMoney(
    'C30',
    'Σ DAY.promotions = Σ DEPT.promotions (all classes)',
    sumCents(day, 'promotions'),
    sumCents(dept, 'promotions'),
    hasAnyDayData || dept.length > 0
  );

  // C31: DAY.total_void_amount = VOIDS.total_void_amount
  checkMoney(
    'C31',
    'Σ DAY.total_void_amount = Σ VOIDS.total_void_amount',
    sumCents(day, 'total_void_amount'),
    sumCents(voids, 'total_void_amount'),
    hasAnyDayData || voids.length > 0
  );

  // C32: DAY.void_line_amount = VOIDS.void_line_amount
  checkMoney(
    'C32',
    'Σ DAY.void_line_amount = Σ VOIDS.void_line_amount',
    sumCents(day, 'void_line_amount'),
    sumCents(voids, 'void_line_amount'),
    hasAnyDayData || voids.length > 0
  );

  // C33: DAY.void_amount = VOIDS.void_amount
  checkMoney(
    'C33',
    'Σ DAY.void_amount = Σ VOIDS.void_amount',
    sumCents(day, 'void_amount'),
    sumCents(voids, 'void_amount'),
    hasAnyDayData || voids.length > 0
  );

  // C34: DAY.refund_amount = - SD(refund).amount (refund amounts are negative in SD)
  checkMoney(
    'C34',
    'Σ DAY.refund_amount = − Σ SD.amount(refund)',
    sumCents(day, 'refund_amount'),
    -sumCents(sdRefund, 'amount'),
    hasAnyDayData || sd.length > 0
  );

  // V02 (V only): DAY.total_sales_with_tax = DAY.ticket_totals - DAY.lottery_payouts
  if (isV) {
    checkMoney(
      'V02',
      'Σ DAY.total_sales_with_tax = Σ DAY.ticket_totals − Σ DAY.lottery_payouts',
      sumCents(day, 'total_sales_with_tax'),
      sumCents(day, 'ticket_totals') - sumCents(day, 'lottery_payouts'),
      hasAnyDayData
    );
  }

  // G01 (G only): FUEL.net_amount = DAY.fuel_net
  if (isG) {
    checkMoney(
      'G01',
      'Σ FUEL.net_amount = Σ DAY.fuel_net',
      sumCents(fuel, 'net_amount'),
      sumCents(day, 'fuel_net'),
      hasAnyDayData || fuel.length > 0
    );
  }

  // G02 (G only): DAY.total_sales_before_tax = DAY.item_sales + DAY.lottery_sales + DAY.fuel_net
  if (isG) {
    checkMoney(
      'G02',
      'Σ DAY.total_sales_before_tax = Σ DAY.item_sales + Σ DAY.lottery_sales + Σ DAY.fuel_net',
      sumCents(day, 'total_sales_before_tax'),
      sumCents(day, 'item_sales') + sumCents(day, 'lottery_sales') + sumCents(day, 'fuel_net'),
      hasAnyDayData
    );
  }

  // Daily Register checks D0-D7
  {
    const drRecords = dr?.records || [];
    if (drError) {
      checks.push({
        id: 'D0–D7',
        description: 'Daily register records match DAY summary, voids, and cash movements',
        left: '—',
        right: day.map((d) => `item: ${roundHalfUp2(d.item_sales)}, fuel: ${roundHalfUp2(d.fuel_gallons)}`).join(' | ') || 'day values',
        difference: 'mismatch',
        result: 'FAIL',
        explanation: `Daily register service query failed with ${drError}. (Backend issue: column 'business_date' ambiguous in report SQL)`,
      });
    } else if (!hasAnyDayData && drRecords.length === 0) {
      checks.push({
        id: 'D0–D7',
        description: 'Daily register records match DAY summary, voids, and cash movements',
        left: '—',
        right: '—',
        difference: '0.00',
        result: 'NO DATA',
        explanation: 'No daily register or day summary records found.',
      });
    } else {
      const dayDateMap = new Map();
      day.forEach((d) => dayDateMap.set(d.business_date, d));

      const drDateMap = new Map();
      drRecords.forEach((r) => drDateMap.set(r.reportDate, r));

      const voidsDateMap = new Map();
      voids.forEach((v) => voidsDateMap.set(v.business_date, v));

      const sdRefundDateMap = new Map();
      sd.filter((s) => s.kind === 'refund').forEach((s) => sdRefundDateMap.set(s.business_date, s));

      // D0: Same set of dates
      let dPass = true;
      const issues = [];

      for (const [date, dayRow] of dayDateMap.entries()) {
        const drRow = drDateMap.get(date);
        if (!drRow) {
          dPass = false;
          issues.push(`Date ${date} missing in daily-register`);
          continue;
        }

        // D1: groceryTotal = DAY.item_sales half-up 2 decimals
        const expectedGrocery = roundHalfUp2(dayRow.item_sales);
        const actualGrocery = roundHalfUp2(drRow.groceryTotal);
        if (expectedGrocery !== actualGrocery) {
          dPass = false;
          issues.push(`${date} groceryTotal ${actualGrocery} ≠ ${expectedGrocery}`);
        }

        // D2: volume = DAY.fuel_gallons half-up 2 decimals
        const expectedVolume = roundHalfUp2(dayRow.fuel_gallons);
        const actualVolume = roundHalfUp2(drRow.volume);
        if (expectedVolume !== actualVolume) {
          dPass = false;
          issues.push(`${date} volume ${actualVolume} ≠ ${expectedVolume}`);
        }

        // D3: noSale = DAY.no_sales
        const expectedNoSale = dayRow.no_sales || 0;
        const actualNoSale = drRow.noSale || 0;
        if (expectedNoSale !== actualNoSale) {
          dPass = false;
          issues.push(`${date} noSale ${actualNoSale} ≠ ${expectedNoSale}`);
        }

        // D4: lineVoid = VOIDS.void_lines
        const voidRow = voidsDateMap.get(date);
        const expectedLineVoid = voidRow?.void_lines || 0;
        const actualLineVoid = drRow.lineVoid || 0;
        if (expectedLineVoid !== actualLineVoid) {
          dPass = false;
          issues.push(`${date} lineVoid ${actualLineVoid} ≠ ${expectedLineVoid}`);
        }

        // D5: voidAmount = VOIDS.total_void_amount, and = DAY.total_void_amount
        const expectedVoidAmount = toCents(voidRow?.total_void_amount);
        const actualVoidAmount = toCents(drRow.voidAmount);
        if (expectedVoidAmount !== actualVoidAmount) {
          dPass = false;
          issues.push(`${date} voidAmount ${fromCents(actualVoidAmount)} ≠ ${fromCents(expectedVoidAmount)}`);
        }
        const dayVoidAmount = toCents(dayRow.total_void_amount);
        if (dayVoidAmount !== actualVoidAmount) {
          dPass = false;
          issues.push(`${date} voidAmount ${fromCents(actualVoidAmount)} ≠ day total_void_amount ${fromCents(dayVoidAmount)}`);
        }

        // D6: refunds = - (SD.amount kind refund)
        const sdRef = sdRefundDateMap.get(date);
        const expectedRefunds = -toCents(sdRef?.amount);
        const actualRefunds = toCents(drRow.refunds);
        if (expectedRefunds !== actualRefunds) {
          dPass = false;
          issues.push(`${date} refunds ${fromCents(actualRefunds)} ≠ ${fromCents(expectedRefunds)}`);
        }

        // D7: cashDeposit / checkDeposit
        if (isV) {
          const expCash = toCents(dayRow.cash_deposit);
          const actCash = toCents(drRow.cashDeposit);
          const expCheck = toCents(dayRow.check_deposit);
          const actCheck = toCents(drRow.checkDeposit);
          if (expCash !== actCash || expCheck !== actCheck) {
            dPass = false;
            issues.push(`${date} deposits cash/check mismatch`);
          }
        } else if (isG) {
          // Must be absent or null
          if (drRow.cashDeposit != null || drRow.checkDeposit != null) {
            dPass = false;
            issues.push(`${date} deposit fields should be absent for Gilbarco`);
          }
        }
      }

      const summaryLeft = drRecords.map((r) => `grocery: ${roundHalfUp2(r.groceryTotal)}, vol: ${roundHalfUp2(r.volume)}`).join(' | ');
      const summaryRight = day.map((d) => `item: ${roundHalfUp2(d.item_sales)}, fuel: ${roundHalfUp2(d.fuel_gallons)}`).join(' | ');

      checks.push({
        id: 'D0–D7',
        description: 'Daily register records match day-summary, voids, and cash movements',
        left: summaryLeft || 'records',
        right: summaryRight || 'day values',
        difference: dPass ? '0.00' : 'mismatch',
        result: dPass ? 'PASS' : 'FAIL',
        explanation: dPass ? 'All days match expected values and deposit rules' : issues.join('; '),
      });
    }
  }

  // Monthly Report M1-M3
  {
    const depts = mon?.departments || [];
    const totals = mon?.totals || {};
    const hasMonData = depts.length > 0;
    // totals cover merchandise only; lottery and fuel have their own entries in classTotals.
    // A server without salesClass on the rows still sums every department into totals.
    const hasClasses = depts.some((d) => d.salesClass);
    const merchDepts = hasClasses ? depts.filter((d) => d.salesClass === 'merchandise') : depts;
    const merchDeptM = hasClasses ? deptM.filter((d) => d.sales_class === 'merchandise') : deptM;

    if (!hasMonData) {
      checks.push({
        id: 'M1–M3',
        description: 'Monthly report arithmetic, department sums, and full-month DEPT_M tie',
        left: '—',
        right: '—',
        difference: '0.00',
        result: 'NO DATA',
        explanation: 'No monthly report loaded for target month.',
      });
    } else {
      let mPass = true;
      const issues = [];

      // M1: arithmetic
      // V: gross - refund - promotion - voidAmount = netSales
      // G: gross - refund - promotion - discount = netSales
      for (const d of depts) {
        const gross = toCents(d.gross);
        const ref = toCents(d.refund);
        const promo = toCents(d.promotion);
        const disc = toCents(d.discount);
        const voidAmt = toCents(d.voidAmount);
        const net = toCents(d.netSales);

        const calcNet = isV
          ? gross - ref - promo - voidAmt
          : gross - ref - promo - disc;

        if (calcNet !== net) {
          mPass = false;
          issues.push(`Dept ${d.deptCode || d.deptName} calculated net ${fromCents(calcNet)} ≠ ${fromCents(net)}`);
        }
      }

      // Check totals arithmetic
      {
        const grossTot = toCents(totals.grossTotal);
        const refTot = toCents(totals.refundTotal);
        const promoTot = toCents(totals.promotionTotal);
        const discTot = toCents(totals.discountTotal);
        const voidTot = toCents(totals.voidTotal);
        const netTot = toCents(totals.netSalesTotal);

        const calcTotNet = isV
          ? grossTot - refTot - promoTot - voidTot
          : grossTot - refTot - promoTot - discTot;

        if (calcTotNet !== netTot) {
          mPass = false;
          issues.push(`Totals calculated net ${fromCents(calcTotNet)} ≠ ${fromCents(netTot)}`);
        }

        // M2: totals.*Total = sum of merchandise departments
        if (grossTot !== sumCents(merchDepts, 'gross')) mPass = false;
        if (refTot !== sumCents(merchDepts, 'refund')) mPass = false;
        if (promoTot !== sumCents(merchDepts, 'promotion')) mPass = false;
        if (netTot !== sumCents(merchDepts, 'netSales')) mPass = false;
      }

      // M3: totals.netSalesTotal = sum of DEPT_M.net_sales (merchandise rows)
      const deptMNetSales = sumCents(merchDeptM, 'net_sales');
      const totalsNetSales = toCents(totals.netSalesTotal);
      if (deptM.length > 0 && totalsNetSales !== deptMNetSales) {
        mPass = false;
        issues.push(`Monthly netSalesTotal ${fromCents(totalsNetSales)} ≠ DEPT_M net_sales ${fromCents(deptMNetSales)}`);
      }

      const leftText = isV
        ? `gross ${fromCents(toCents(totals.grossTotal))} − ref ${fromCents(toCents(totals.refundTotal))} − promo ${fromCents(toCents(totals.promotionTotal))} − void ${fromCents(toCents(totals.voidTotal))}`
        : `gross ${fromCents(toCents(totals.grossTotal))} − ref ${fromCents(toCents(totals.refundTotal))} − promo ${fromCents(toCents(totals.promotionTotal))} − disc ${fromCents(toCents(totals.discountTotal))}`;

      checks.push({
        id: 'M1–M3',
        description: 'Monthly report arithmetic, department sums, and full-month DEPT_M tie',
        left: leftText,
        right: `net ${fromCents(toCents(totals.netSalesTotal))}`,
        difference: mPass ? '0.00' : 'mismatch',
        result: mPass ? 'PASS' : 'FAIL',
        explanation: mPass
          ? (isV ? `discount ${fromCents(toCents(totals.discountTotal))}, informational` : `void ${fromCents(toCents(totals.voidTotal))}, informational`)
          : issues.join('; '),
      });
    }
  }

  // Reconciliation checks (WARN)
  // R1 (V only): DAY.sales_counter = DAY.ticket_totals
  if (isV) {
    if (!hasAnyDayData) {
      checks.push({
        id: 'R1',
        description: 'Σ DAY.sales_counter = Σ DAY.ticket_totals',
        left: '—',
        right: '—',
        difference: '0.00',
        result: 'NO DATA',
        explanation: 'No day summary data found.',
      });
    } else {
      const leftCents = sumCents(day, 'sales_counter');
      const rightCents = sumCents(day, 'ticket_totals');
      const diffCents = leftCents - rightCents;
      const pass = diffCents === 0;

      const untiedDays = day
        .filter((d) => d.counter_ties === false || toCents(d.sales_counter) !== toCents(d.ticket_totals))
        .map((d) => `${d.business_date} (diff: ${fromCents(toCents(d.sales_counter) - toCents(d.ticket_totals))})`);

      checks.push({
        id: 'R1',
        description: 'Σ DAY.sales_counter = Σ DAY.ticket_totals',
        left: fromCents(leftCents),
        right: fromCents(rightCents),
        difference: fromCents(diffCents),
        result: pass ? 'PASS' : 'WARN',
        explanation: pass
          ? 'All days tie'
          : `POS counter and counted tickets disagree on: ${untiedDays.join(', ')}`,
      });
    }
  }

  // R2 (both): DAY.payments_net = DAY.total_sales_with_tax + DAY.lottery_payouts
  {
    if (!hasAnyDayData) {
      checks.push({
        id: 'R2',
        description: 'Σ DAY.payments_net = Σ DAY.total_sales_with_tax + Σ DAY.lottery_payouts',
        left: '—',
        right: '—',
        difference: '0.00',
        result: 'NO DATA',
        explanation: 'No day summary data found.',
      });
    } else {
      const leftCents = sumCents(day, 'payments_net');
      // DAY.lottery_payouts is negative!
      const rightCents = sumCents(day, 'total_sales_with_tax') + sumCents(day, 'lottery_payouts');
      const diffCents = leftCents - rightCents;
      const pass = diffCents === 0;

      const differingDays = [];
      for (const d of day) {
        if (d.payments_net == null && d.total_sales_with_tax == null) {
          // Skip days where both values are missing (e.g. Wolf 2026-10-09)
          continue;
        }
        const dLeft = toCents(d.payments_net);
        const dRight = toCents(d.total_sales_with_tax) + toCents(d.lottery_payouts);
        const dDiff = dLeft - dRight;
        if (dDiff !== 0) {
          differingDays.push(`${d.business_date} (diff: ${fromCents(dDiff)})`);
        }
      }

      let exp = 'All days tie';
      if (!pass) {
        if (isV && differingDays.length > 0) {
          exp = `${differingDays.join(', ')}: ticket 9019989 total 32.63, paid CASH 31.00 − change 0.87`;
        } else if (isG) {
          exp = `${differingDays.join(', ')}. Check screen S12 (payment gaps).`;
        } else {
          exp = differingDays.join(', ');
        }
      }

      checks.push({
        id: 'R2',
        description: 'Σ DAY.payments_net = Σ DAY.total_sales_with_tax + Σ DAY.lottery_payouts',
        left: fromCents(leftCents),
        right: fromCents(rightCents),
        difference: fromCents(diffCents),
        result: pass ? 'PASS' : 'WARN',
        explanation: exp,
      });
    }
  }

  // R3 (G only): DAY.payment_gaps & GAP row count = 0
  if (isG) {
    const dayGaps = sumInt(day, 'payment_gaps');
    const gapRows = gaps.length;
    const pass = dayGaps === 0 && gapRows === 0;
    checks.push({
      id: 'R3',
      description: 'Σ DAY.payment_gaps and GAP row count = 0',
      left: `${dayGaps} (rows: ${gapRows})`,
      right: '0',
      difference: `${dayGaps}`,
      result: pass ? 'PASS' : 'WARN',
      explanation: pass ? 'No payment gaps recorded' : 'Transactions whose payments differ from lines + tax',
    });
  }

  // R4 (V only): DAY.cash_deposit + DAY.check_deposit = DAY.safe_drop_amount
  if (isV) {
    if (!hasAnyDayData) {
      checks.push({
        id: 'R4',
        description: 'Σ DAY.cash_deposit + Σ DAY.check_deposit = Σ DAY.safe_drop_amount',
        left: '—',
        right: '—',
        difference: '0.00',
        result: 'NO DATA',
        explanation: 'No day summary data found.',
      });
    } else {
      const leftCents = sumCents(day, 'cash_deposit') + sumCents(day, 'check_deposit');
      const rightCents = sumCents(day, 'safe_drop_amount');
      const diffCents = leftCents - rightCents;
      const pass = diffCents === 0;

      checks.push({
        id: 'R4',
        description: 'Σ DAY.cash_deposit + Σ DAY.check_deposit = Σ DAY.safe_drop_amount',
        left: fromCents(leftCents),
        right: fromCents(rightCents),
        difference: fromCents(diffCents),
        result: pass ? 'PASS' : 'WARN',
        explanation: pass ? 'All safe drops deposited in cash/check' : 'Safe drop paid with tender other than cash or check',
      });
    }
  }

  // I1 (V only): FUEL.amount vs DAY.fuel_sales
  if (isV) {
    const leftCents = sumCents(fuel, 'amount');
    const rightCents = sumCents(day, 'fuel_sales');
    const diffCents = leftCents - rightCents;

    checks.push({
      id: 'I1',
      description: 'Σ FUEL.amount vs Σ DAY.fuel_sales (pumped fuel vs fuel dept lines)',
      left: fromCents(leftCents),
      right: fromCents(rightCents),
      difference: fromCents(diffCents),
      result: 'INFO',
      explanation: 'FUEL shows pumped fuel only; DAY.fuel_sales includes every line of a fuel-type department, e.g. an item scanned into "MANUAL FUEL DEPT". C10 is the exact check for DAY.fuel_sales.',
    });
  }

  return checks;
}

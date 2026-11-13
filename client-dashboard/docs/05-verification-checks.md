# 05 — Verification checks

The Checks screen proves that the endpoints agree with each other for one store and one date range. Every
check compares two numbers built **only from API responses**. The dashboard does no business calculation of
its own: only sums, sign flips and the comparisons written here.

## 1. How to compare (no float errors)
- Convert each money value to **integer cents** (`Math.round(Number(v) * 100)`) and each gallons value to
  **integer thousandths** (`Math.round(Number(v) * 1000)`) **before** summing. Sum the integers.
- A missing key or `null` counts as 0. A sum or count over zero rows is 0 (e.g. no payout rows means 0
  payouts, which is a real value).
- The result is `NO DATA` only when **both** sides have no input at all: every list they read is empty, or
  every value they read is missing. Otherwise compare, with missing values as 0.
- Counts are integers already.
- Equal means exactly equal in those units (tolerance 0).
- `difference = left − right`, shown in the original unit (cents / 100, thousandths / 1000).

## 2. Calls the Checks screen makes (same `store`, `from`, `to` for all)
| Key | Call |
|---|---|
| DAY | `day-summary` |
| ITEMS | `items-sold?byDay=false&limit=20000` |
| DEPT | `departments?byDay=false` |
| FUEL | `fuel?byDay=false&byPriceLevel=false` |
| PAY | `payments?byDay=false` |
| CASH | `cash-movements` |
| SD | `suspicious/daily` |
| SE | `suspicious/events?limit=20000` |
| VOIDS | `voids` |
| LOT | `lottery` |
| LOTP | `lottery-payouts` |
| DR | `daily-register?store&from&to` |
| MON | `departments/monthly?store&month&year` (month/year of `to`) and DEPT_M = `departments?byDay=false` with `from` = first and `to` = last day of that month |
| GAP | `payment-gaps` (Gilbarco only) |

`Σ DAY.x` = sum of field `x` over all day-summary rows. `Σ DEPT[cls].x` = sum over department rows whose
`sales_class = cls`.

If ITEMS or SE returns exactly 20000 rows, every check that uses it is `WARN (truncated)`.

## 3. Result levels
| Result | When | Meaning |
|---|---|---|
| PASS | equal | — |
| FAIL | a **definitional** check is not equal | the two endpoints are built from the same data and must agree: a service or view bug |
| WARN | a **reconciliation** check is not equal | the POS data itself does not tie (a real store event to look at), or a list was truncated |
| INFO | an **explained difference** check | the difference is expected and its cause is written next to it |
| NO DATA | all inputs missing | nothing loaded for the range |

## 4. Definitional checks (FAIL when unequal)
| ID | Vendor | Left | Right |
|---|---|---|---|
| C01 | both | Σ ITEMS.net_sales | Σ DAY.item_sales |
| C02 | both | Σ DEPT[merchandise].net_sales | Σ DAY.item_sales |
| C03 | both | Σ DEPT[lottery_sale].net_sales | Σ DAY.lottery_sales |
| C04 | both | Σ DEPT[lottery_payout].net_sales | Σ DAY.lottery_payouts |
| C05 | both | Σ LOT.sales_amount | Σ DAY.lottery_sales |
| C06 | both | Σ LOT.payout_amount | − Σ DAY.lottery_payouts |
| C07 | both | Σ LOT.payouts | Σ DAY.lottery_payout_count |
| C08 | **G only** | Σ FUEL.amount | Σ DAY.fuel_sales |
| C09 | both | Σ FUEL.gallons | Σ DAY.fuel_gallons |
| C10 | both | Σ DEPT[fuel].gross_sales | Σ DAY.fuel_sales |
| C11 | both | Σ PAY.net_amount | Σ DAY.payments_net |
| C12 | both | count CASH where kind=safe_drop | Σ DAY.safe_drops |
| C13 | both | Σ CASH.amount where kind=safe_drop | Σ DAY.safe_drop_amount |
| C14 | both | count / Σ amount of CASH where kind=payout | Σ DAY.payouts / Σ DAY.payout_amount (two comparisons) |
| C15 | both | count / Σ amount of CASH where kind=safe_loan | Σ DAY.safe_loans / Σ DAY.safe_loan_amount (two comparisons) |
| C16 | both | Σ SD.occurrences where kind=no_sale | Σ DAY.no_sales |
| C17 | both | Σ SD.occurrences where kind=void_line | Σ DAY.void_lines |
| C18 | both | Σ SD.occurrences where kind=void | Σ DAY.voids |
| C19 | both | Σ SD.occurrences where kind=refund | Σ DAY.refunds |
| C20 | both | Σ VOIDS.void_lines | Σ DAY.void_lines |
| C21 | both | Σ VOIDS.voids | Σ DAY.voids |
| C22 | both | Σ DAY.total_sales_with_tax | Σ DAY.total_sales_before_tax + Σ DAY.tax |
| C23 | both | Σ DEPT.net_sales (all classes) | Σ DAY.total_sales_before_tax + Σ DAY.lottery_payouts |
| C24 | both | Σ DAY.merchandise_net | Σ DAY.item_sales |
| C26 | both | number of SE rows of kind k | Σ SD.occurrences of kind k. One comparison per kind k that appears in SE or SD, out of `no_sale`, `void_line`, `void`, `refund` and (V) `refund_void`. Not for the two Gilbarco-only kinds, whose occurrences count items, not rows |
| C27 | both | Σ LOTP.payouts | Σ LOT.payouts |
| C28 | both | Σ LOTP.payout_amount | Σ LOT.payout_amount |
| C29 | both | Σ SD.amount where kind=void | Σ VOIDS.void_amount |
| C30 | both | Σ DAY.promotions | Σ DEPT.promotions (all classes) |
| C31 | both | Σ DAY.total_void_amount | Σ VOIDS.total_void_amount |
| C32 | both | Σ DAY.void_line_amount | Σ VOIDS.void_line_amount |
| C33 | both | Σ DAY.void_amount | Σ VOIDS.void_amount |
| C34 | both | Σ DAY.refund_amount | − Σ SD.amount where kind=refund |
| V02 | **V only** | Σ DAY.total_sales_with_tax | Σ DAY.ticket_totals − Σ DAY.lottery_payouts |
| G01 | **G only** | Σ FUEL.net_amount | Σ DAY.fuel_net |
| G02 | **G only** | Σ DAY.total_sales_before_tax | Σ DAY.item_sales + Σ DAY.lottery_sales + Σ DAY.fuel_net |

### Daily register (per day; FAIL when unequal)
Match DR `records[].reportDate` to DAY `business_date`. Both lists must hold the same set of dates (else
FAIL `D0`).

| ID | Vendor | Left (DR record) | Right |
|---|---|---|---|
| D1 | both | groceryTotal | DAY.item_sales, rounded half-up to 2 decimals (null → 0) |
| D2 | both | volume | DAY.fuel_gallons rounded **half-up to 2 decimals** (null → 0) |
| D3 | both | noSale | DAY.no_sales |
| D4 | both | lineVoid | VOIDS.void_lines of that day (no row → 0) |
| D5 | both | voidAmount | VOIDS.total_void_amount of that day (no row → 0), and DAY.total_void_amount (null → 0) |
| D6 | both | refunds | − (SD.amount of kind refund that day; no row → 0) |
| D7 | V | cashDeposit, checkDeposit | DAY.cash_deposit, DAY.check_deposit (null → 0) |
| D7 | G | cashDeposit, checkDeposit | must be **absent or null** (PASS when absent) |

### Monthly report (FAIL when unequal)
| ID | Vendor | Check |
|---|---|---|
| M1 | V | for every department row and for totals: `gross − refund − promotion − voidAmount = netSales` |
| M1 | G | for every department row and for totals: `gross − refund − promotion − discount = netSales` |
| M2 | both | each `totals.*Total` = sum of that field over the `departments` with `salesClass = merchandise` |
| M3 | both | `totals.netSalesTotal` = Σ DEPT_M.net_sales over rows with `sales_class = merchandise` |

## 5. Reconciliation checks (WARN when unequal)
R1 and R2 compare range sums, like every other check. Their explanation then lists each **day** whose own
two values differ, with that day's difference. A day where both values are missing is skipped (e.g. Wolf
2026-10-09).

| ID | Vendor | Left | Right | When it is not equal |
|---|---|---|---|---|
| R1 | V | Σ DAY.sales_counter | Σ DAY.ticket_totals | the POS counter and the counted tickets disagree (`counter_ties=false` on the listed days) |
| R2 | both | Σ DAY.payments_net | Σ DAY.total_sales_with_tax + Σ DAY.lottery_payouts | money taken ≠ what was sold on the listed days. On G, open S12 (payment gaps) |
| R3 | G | Σ DAY.payment_gaps, and the GAP row count | 0 | transactions whose payments ≠ lines + tax |
| R4 | V | Σ DAY.cash_deposit + Σ DAY.check_deposit | Σ DAY.safe_drop_amount | a safe drop was paid with a tender other than cash or check |

## 6. Explained differences (INFO, always shown with the difference)
| ID | Vendor | Left | Right | Explanation |
|---|---|---|---|---|
| I1 | V | Σ FUEL.amount | Σ DAY.fuel_sales | FUEL shows pumped fuel only; DAY.fuel_sales includes every line of a fuel-type department, e.g. an item scanned into "MANUAL FUEL DEPT". C10 is the exact check for DAY.fuel_sales. |

## 7. Expected results on today's data (2026-10-24 snapshot, full loaded range)
Tiki Hut `8730_IN-47872` (Verifone), 2026-09-08 .. 2026-10-15 (3 business days):

| Check | Left | Right | Result |
|---|---|---|---|
| C01, C02, C24 | 13361.43 | 13361.43 | PASS |
| C03, C05 | 1883.50 | 1883.50 | PASS |
| C04 | −1435.00 | −1435.00 | PASS |
| C06, C28 | 1435.00 | 1435.00 | PASS |
| C07, C27 | 42 | 42 | PASS |
| C09 | 5752.387 | 5752.387 | PASS |
| C10 | 24399.38 | 24399.38 | PASS |
| C11 | 39096.84 | 39096.84 | PASS |
| C12 / C13 | 3 / 8103.00 | 3 / 8103.00 | PASS |
| C14, C15 | 0 / 0.00 | 0 / 0.00 | PASS |
| C16 / C17 / C18 / C19 | 32 / 21 / 10 / 0 | same | PASS |
| C20 / C21 | 21 / 10 | 21 / 10 | PASS |
| C22, V02 | 40534.34 | 40534.34 | PASS |
| C23 | 38209.31 | 38209.31 | PASS |
| C26 | no_sale 32, void_line 21, void 10 (no refund rows) | same | PASS |
| C29 | 900.13 | 900.13 | PASS |
| C30 | 157.56 | 157.56 | PASS |
| C31 | 1038.43 | 1038.43 | PASS |
| C32 | 138.30 | 138.30 | PASS |
| C33 | 900.13 | 900.13 | PASS (same VOIDS.void_amount as C29) |
| C34 | 0.00 | 0.00 | PASS (no refund rows) |
| R1 | 39099.34 | 39099.34 | PASS (all 3 days tie) |
| R2 | 39096.84 | 39099.34 | **WARN −2.50**: 2026-10-15, ticket 9019989 total 32.63, paid CASH 31.00 − change 0.87 |
| R4 | 8103.00 | 8103.00 | PASS |
| I1 | 24390.79 | 24399.38 | **INFO −8.59**: one "FVP PREMIER ATF QT" scanned into dept 9998 MANUAL FUEL DEPT on 2026-10-15 |
| M1, M2, M3 (October 2026) | gross 26825.26 − refund 0 − promotion 110.11 − void 114.73 | net 26600.42 | PASS (discount 9.28, informational) |
| D0–D7 | groceryTotal 4130.89 / 4424.65 / 4805.89; volume 1790.20 / 1767.33 / 2194.85; cashDeposit 2508.00 / 2474.00 / 3121.00 | day values | PASS |

Wolf `800_NY-13208` (Gilbarco), 2026-10-09 .. 2026-10-15 (2 business days):

| Check | Left | Right | Result |
|---|---|---|---|
| C01, C02, C24 | 5046.79 | 5046.79 | PASS |
| C03, C05 | 1122.50 | 1122.50 | PASS |
| C04 | −1933.00 | −1933.00 | PASS |
| C06, C28 | 1933.00 | 1933.00 | PASS |
| C07, C27 | 43 | 43 | PASS |
| C08, C10 | 7665.93 | 7665.93 | PASS |
| C09 | 1698.399 | 1698.399 | PASS |
| C11, R2 | 12108.02 | 12108.02 | PASS |
| C12 / C13 | 4 / 5404.00 | 4 / 5404.00 | PASS |
| C14 | 2 / 527.25 | 2 / 527.25 | PASS |
| C15 | 4 / 600.00 | 4 / 600.00 | PASS |
| C16 / C17 / C18 / C19 | 7 / 36 / 1 / 0 | same | PASS |
| C20 / C21 | 36 / 1 | 36 / 1 | PASS |
| C22 | 14041.02 | 14041.02 | PASS |
| C23 | 11899.68 | 11899.68 | PASS |
| C26 | no_sale 7, void_line 36, void 1 | same | PASS |
| C29 | 3.99 | 3.99 | PASS |
| C30 | 73.78 | 73.78 | PASS |
| C31 | 205.64 | 205.64 | PASS (= daily-register voidAmount) |
| C32 | 201.65 | 201.65 | PASS |
| C33 | 3.99 | 3.99 | PASS |
| C34 | 0.00 | 0.00 | PASS (no refund rows) |
| G01 | 7663.39 | 7663.39 | PASS |
| G02 | 13832.68 | 13832.68 | PASS |
| R3 | 0 | 0 | PASS |
| M1, M2, M3 (October 2026) | gross 11973.46 − refund 0 − promotion 73.78 − discount 0.00 | net 11899.68 | PASS (void 201.65, informational) |
| D0–D7 | 2026-10-09: all 0; 2026-10-15: groceryTotal 5046.79, volume 1698.40, lineVoid 36, voidAmount 205.64; no deposit fields | day values | PASS |

An implementation is correct when, for these two stores and ranges, it shows exactly these results. Any
other FAIL is either a dashboard bug (check the summing first) or a real service bug.

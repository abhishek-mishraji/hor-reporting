# 03 — API reference (both services)

Paths are relative to the service. From the browser, prefix them with `/svc/verifone` or `/svc/gilbarco`
(see [02](02-architecture-and-auth.md) §2). **V** = Verifone service, **G** = Gilbarco service.

Conventions for every endpoint below:
- `store` = store code (e.g. `8730_IN-47872`). `from`, `to` = inclusive ISO dates on `business_date`.
- Report rows are JSON objects with **snake_case** keys, except the monthly and daily-register reports
  (camelCase, noted there).
- A value can be `null`, or the key can be missing. Treat both as "no value"; never show them as `0`.
- Money has 2 decimals. Fuel volume (gallons) has 3 decimals. Counts are integers.
- Dates are `YYYY-MM-DD`. Times are `YYYY-MM-DDTHH:MM:SS` without an offset, always on the **store's local
  clock**, for both vendors. They don't depend on the time zone of the server or the browser: show them as
  they are and never convert them.
- `format=csv` is accepted by every report endpoint below except `stores`, `date-range`, `status` and the
  drill-downs.

---

## Public
### `GET /api/reporting/status` (V, G) — no login needed
`{"service":"verifone-reporting-service"|"gilbarco-reporting-service","status":"UP","version":"0.1.0"}`

## Stores
### `GET /api/reports/stores` (V, G)
The stores of this vendor that the user may see:
`[{store_id, store_code, store_name, pos_vendor, timezone, status}]`.

### `GET /api/reports/date-range` (V, G)
The same stores, with the loaded data range:
`[{store_id, store_code, store_name, pos_vendor, first_day, last_day, files}]`.
`first_day` / `last_day` are `null` when nothing is loaded.

---

## Day summary
### `GET /api/reports/day-summary?store&from&to` (V, G)
One row per business day.

| Field | V | G | Meaning |
|---|---|---|---|
| store_id, store_code, business_date | ✓ | ✓ | keys |
| files | ✓ | ✓ | files loaded for the day (V: CPJ day files, G: PJR transaction files) |
| period_opened | ✓ | ✓ | V: first file opened; G: first shift began |
| period_closed | ✓ | – | last file closed |
| first_event, last_event, shifts | – | ✓ | first / last transaction time, number of shifts |
| customers | ✓ | ✓ | counted sale transactions |
| pump_sales, prepay_deposits | – | ✓ | sales paid at the pump; parked prepay deposits |
| item_sales | ✓ | ✓ | scanned items + department rings, merchandise only (= merchandise_net) |
| merchandise_net | ✓ | ✓ | same value as item_sales |
| lottery_sales | ✓ | ✓ | lottery ticket sales (positive) |
| lottery_payouts | ✓ | ✓ | lottery winnings paid, **negative**; never subtracted from totals |
| lottery_payout_count | ✓ | ✓ | number of payout lines |
| fuel_sales | ✓ | ✓ | V: all lines of fuel-type departments (gross); G: fuel lines (gross) |
| fuel_net | – | ✓ | fuel after fuel discounts |
| fuel_gallons | ✓ | ✓ | gallons pumped |
| promotions | ✓ | ✓ | promotion amount (V: mix-and-match; G: promotions + discounts) |
| tax | ✓ | ✓ | tax collected |
| total_sales_before_tax | ✓ | ✓ | everything sold before tax; lottery payouts **not** subtracted |
| total_sales_with_tax | ✓ | ✓ | total_sales_before_tax + tax |
| payments_net | ✓ | ✓ | money taken over all payment types (change already subtracted) |
| sales_counter, ticket_totals, counter_ties | ✓ | – | POS overall-sales counter change for the day; sum of counted ticket totals; `true` when equal |
| refunded_money, refund_voids, cash_deposit, check_deposit | ✓ | – | money back on cancelled payments; refund-void count; safe drops paid in cash / check |
| payment_gaps, payments_tie | – | ✓ | transactions whose payments ≠ lines + tax; `true` when 0 |
| safe_drops, safe_drop_amount | ✓ | ✓ | count and amount of safe drops |
| payouts, payout_amount | ✓ | ✓ | store paid-outs (not lottery) |
| safe_loans, safe_loan_amount | ✓ | ✓ | V: safe loans; G: register opened with starting cash |
| no_sales | ✓ | ✓ | drawer opened without a sale |
| void_lines | ✓ | ✓ | **V: voided lines. G: transactions with at least one voided line** |
| voids | ✓ | ✓ | whole transactions cancelled |
| refunds | ✓ | ✓ | refunded lines |
| void_line_amount | ✓ | ✓ | value of voided lines, positive (0 when none). V: value removed; G: regular price × quantity (a department ring with no price counts 0). Same as voids `void_line_amount` |
| void_amount | ✓ | ✓ | value of whole-transaction voids, positive. **V: before tax; G: with tax.** Same as voids `void_amount` |
| total_void_amount | ✓ | ✓ | void_line_amount + void_amount. Same as voids `total_void_amount` |
| refund_amount | ✓ | ✓ | value of the refunded items, positive (= − Σ suspicious `refund` amount). Not the same as V `refunded_money` (cash handed back) |

---

## Items sold
### `GET /api/reports/items-sold?store&from&to&dept&itemType&q&byDay&sort&limit` (V, G)
Merchandise only: lottery and fuel are excluded.
- `itemType` = `scanned` | `department ring`. `dept` = department number. `q` = text in UPC or description.
- `sort` = `net_sales` (default) | `units_sold` | `gross_sales` | `tickets` | `description` | `upc`.
- `limit`: default **500**, capped at 20000. **Checks must send `limit=20000`.** If the row count equals the
  limit, the list may be cut off: mark the check as WARN "truncated".
- `byDay=false` (default): one row per item over the range. Fields: `store_code, item_type, upc,
  description, dept_number, dept_name, sales_class, units_sold, gross_sales, promotions, net_sales,
  tickets, days`.
- `byDay=true`: one row per item per day. Fields: `store_id, store_code, business_date, item_type, upc,
  description, dept_number, dept_name, sales_class, units_sold, gross_sales, promotions, net_sales, tickets`.
- `net_sales = gross_sales − promotions`. `upc` is `null` for department rings.

## Departments
### `GET /api/reports/departments?store&from&to&salesClass&byDay` (V, G)
All lines by department. `salesClass` = `merchandise` | `lottery_sale` | `lottery_payout` | `fuel`.
- `byDay=false`: `store_code, dept_number, dept_name, sales_class, units_sold, gross_sales, promotions,
  net_sales, fuel_gallons, lines`.
- `byDay=true`: one row per department per day, adding `store_id, business_date, discount, refund,
  void_amount` (all positive amounts).
- Sign: rows of class `lottery_payout` have **negative** `net_sales`.
- Do not show the same `dept_number` twice as two departments when it appears with two `sales_class` values;
  the class is part of the row key.

## Monthly department report
### `GET /api/reports/departments/monthly?store&month&year` (V, G; also under `/api/v1/...`)
`store`, `month` (1–12) and `year` are required. **camelCase** JSON:
`{storeCode, storeName, reportMonth, reportYear, posType, departments:[{deptCode, deptName, salesClass, gross,
discount, promotion, refund, voidAmount, netSales}], totals:{grossTotal, discountTotal, promotionTotal,
refundTotal, voidTotal, netSalesTotal}, classTotals:{<salesClass>: {same fields as totals}}}`.
`posType` = `VERIFONE_CPJ` | `GILBARCO_PJR`. One row per department number **and sales class**, ordered
merchandise, lottery_sale, lottery_payout, fuel, then by name.
- `totals` covers **merchandise only**: lottery and fuel are never part of merchandise sales. Their figures are
  in `classTotals` (one entry per class present; a row without a class is `other`).
- CSV: adds a `Sales Class` column and one `TOTAL` line per class instead of one grand total.
- V: `gross − refund − promotion − voidAmount = netSales`. `discount` is informational: it is already inside
  the line totals.
- G: `gross − refund − promotion − discount = netSales`. `voidAmount` is informational: voided lines never
  reach gross or net in PJR data.

## Fuel
### `GET /api/reports/fuel?store&from&to&byDay&byPriceLevel` (V, G)
Pumped fuel only (V: `postFuel` lines; G: fuel lines).
- V fields: `store_code, [business_date], fuel_grade, [fuel_price_level], gallons, amount, fuel_sales,
  ppg_discount, avg_price`.
- G fields: `store_code, [business_date], fuel_grade_id, fuel_grade, [fuel_price_level], gallons, amount,
  net_amount, fuel_sales, fuel_discount, avg_price`.
- `[business_date]` only with `byDay=true`; `[fuel_price_level]` only with `byPriceLevel=true`.
- `amount` = gross dollars; `fuel_sales` = number of dispenses; `avg_price = round(amount / gallons, 3)`.
- Price level values: V `CASH` / `CREDIT`; G tier codes such as `0001` / `0002`.
- A row with 0 gallons and 0 amount is possible if the POS writes a grade with nothing pumped (the prototype
  saw this; there is none in today's data). If one appears, show it; don't hide it.

## Payments
### `GET /api/reports/payments?store&from&to&byDay` (V, G)
- V fields: `store_code, [business_date], payment_type, payments, sales_amount, refunds, refunded_amount,
  net_amount`. Change is merged into `CASH`.
- G fields: the same plus `tender_code, tender_sub`. Payment type names are the StoreClose names (`Cash`,
  `Credit`, `Debit`, `EBT Food`, `HOUSE`, `Crind CREDIT`, `Crind DEBIT`, or `code/sub`).
- `net_amount` = money taken for that type over counted transactions.

## Cash movements
### `GET /api/reports/cash-movements?store&from&to&kind` (V, G)
One row per movement. `kind` = `safe_drop` | `payout` | `safe_loan` (both vendors), plus `pay_in` (G only).
- V fields: `store_id, store_code, business_date, kind, occurred_at, register, cashier, ticket_number,
  file_id, ticket_seq, amount, reference, paid_with`.
- G fields: `store_id, store_code, business_date, kind, occurred_at, register, cashier, till,
  ticket_number, file_id, amount, reference`.
- `reference` = payout name or safe-drop number. Amounts are positive in the loaded data.
- The day summary counts `safe_drop`, `payout` and `safe_loan`, not `pay_in`.

## Suspicious activity
### `GET /api/reports/suspicious/events?store&from&to&kind&register&limit` (V, G)
Every occurrence. `limit`: default 5000, capped at 20000.
- Kinds: `no_sale`, `void_line`, `void`, `refund` (both); `refund_void` (V only);
  `void_line_in_prepay_deposit`, `void_line_in_voided_transaction` (G only, never counted in the day summary).
- V fields: `store_id, store_code, business_date, occurred_at, kind, register, cashier, ticket_number,
  file_id, ticket_seq, amount, item, quantity, duration_sec, detail, started_at, ended_at`.
- G fields: the same without `ticket_seq`, plus `lines` (items voided in that transaction).
- G: one `void_line` row per **transaction** (the items are joined in `item`). V: one row per voided **line**.
- `amount` signs: see the table at the end of this file.

**Voided items (Suspicious page).** The dashboard also calls `suspicious/events?store&from&to&limit=20000`
with no `kind` / `register` and keeps only the void kinds (V: `void_line`, `void`; G: those plus
`void_line_in_prepay_deposit`, `void_line_in_voided_transaction`), sorted by `business_date`, `occurred_at`.
Columns (`voidItems` in `src/reportColumns.js`): Date, Time, Void type, Register, Cashier, Product(s) (`item`),
Qty (`quantity`), Items voided (`lines`, G only), Amount, Ticket # on by default; Detail, Duration (sec)
optional. Amounts are shown positive: V `void_line` (negative by convention) is sign-flipped; every other
amount is shown as returned, so a void that really is negative (Wolf 2026-10-19, −0.01) stays negative and
the totals match the voids report. Per row:

| kind | vendor | one row per | item | quantity | amount | lines |
|---|---|---|---|---|---|---|
| void_line | V | voided line | product description | units | negative line value | – |
| void_line, void_line_in_prepay_deposit, void_line_in_voided_transaction | G | transaction with voided lines | comma-joined voided products | total units | positive regular price × qty (`null` if only department rings) | items voided |
| void | V | cancelled ticket | comma-joined products | – | ticket total before tax | – |
| void | G | cancelled transaction | comma-joined products / prepay | – | transaction total with tax | – |

The line / transaction totals of this list equal voids `void_line_amount` / `void_amount` for the same range,
except Gilbarco `void_line_in_prepay_deposit` / `void_line_in_voided_transaction`, which the voids totals leave
out. Its CSV is built in the browser from the rows shown (visible columns, BOM, CRLF, raw values), because
the server CSV filters on one kind only.

### `GET /api/reports/suspicious/daily?store&from&to` (V, G)
`store_id, store_code, business_date, kind, occurrences, amount`, one row per day per kind.

### `GET /api/reports/voids?store&from&to` (V, G)
One row per day:
- V: `store_id, store_code, business_date, void_lines, voided_units, void_line_transactions,
  void_line_amount, voids, void_amount, total_voids, total_void_amount`.
- G: the same, plus `void_ring_lines, deposit_void_lines, deposit_void_line_amount, voided_txn_void_lines,
  voided_txn_void_line_amount`.
- `total_voids = void_lines + voids`; `total_void_amount = void_line_amount + void_amount`.
- `void_amount`: V = before tax; G = with tax (matches the StoreClose "Transaction Voids").
- On G, `void_lines` and `void_line_transactions` are the same number (transactions).

## Lottery
### `GET /api/reports/lottery?store&from&to` (V, G)
`store_id, store_code, business_date, sales_lines, sales_units, sales_amount, payouts, payout_amount`
(both amounts positive).

### `GET /api/reports/lottery-payouts?store&from&to` (V, G)
`store_id, store_code, business_date, payouts, payout_amount` (positive).

## Lottery figures entered by admin / staff (Daily report)
### `GET /api/reports/daily-lottery?store&date` (V, G) — every role that may see the store
### `PUT /api/reports/daily-lottery?store&date` (V, G) — `PLATFORM_ADMIN`, `HOR_STAFF` only (`CLIENT_USER`: 403)
Same contract and same code in both services (`scripts/check-lottery-sync.sh` fails when they drift). Stored in
`report.lottery_day_entry` + `report.lottery_day_entry_change` (history) of the vendor database (verifone_db
migration V4, gilbarco_db V7, run by the ingestion services). The POS figures are **not** in this answer: the page
takes them from `departments` and lets an entered value replace them field by field.

Fields (amount = dollars, 2 decimals, may be negative; count = whole number ≥ 0):
`lottery_sales`, `lottery_tickets` (register without scratch-off / online split), `scratch_sales`, `scratch_tickets`,
`online_sales`, `online_tickets`, `online_cashes`, `scratch_cashes`, `cashes_tickets`, `settlement`, `adjustment`,
`online_credit`, `scratch_credit`, `commission`.

GET answer: `{store_code, business_date, can_edit, version, values: {field: number}, updated_by_name, updated_at}`.
`values` holds only the entered fields (a missing field uses the POS figure); `version` is 0 and
`updated_by_name` / `updated_at` are missing when nothing was entered. `updated_at` is an ISO time with offset.

PUT body: `{"version": <version loaded>, "values": {"commission": 45.60, "settlement": null}}`. Only the listed
fields change; `null` = back to the POS figure. Answer = the GET answer after the save. Errors:
`409 VERSION_CONFLICT` (+ `current_version`) when someone saved the day after it was loaded; `400
VALIDATION_FAILED` with `errors[{field, message}]` for an unknown field, more than 2 decimals, a negative or
fractional ticket count, or a missing `version`. Saving values that are already stored changes nothing (version
stays). Every changed field adds one history row (old value, new value, who, when).

## Payment gaps (G only)
### `GET /api/reports/payment-gaps?store&from&to`
Counted transactions whose payments differ from lines + tax: `store_id, store_code, business_date, file_id,
ticket_number, register, started_at, ended_at, event_type, total_grand, paid, lines_plus_tax, gap`.
An empty list is the expected, correct answer.

## Daily register report
### `GET /api/reports/daily-register?store&date` or `?store&from&to` (V, G; also under `/api/v1/...`)
`store` is required. Pass `date` for one day, or `from` + `to`. With none of them, the server uses the last 30
days ending today. **camelCase** JSON:
`{storeCode, storeName, posType, records:[{reportDate, groceryTotal, volume, cashDeposit, checkDeposit,
noSale, lineVoid, voidAmount, refunds}]}`. One record per day-summary day.
- `groceryTotal` = day `item_sales`, `volume` = day `fuel_gallons`. **Both are rounded to 2 decimals.**
- `noSale` = day `no_sales`; `lineVoid` = voids `void_lines`; `voidAmount` = voids `total_void_amount`.
- `refunds` = the refund amount, shown positive (minus the sum of suspicious `refund` amounts).
- `cashDeposit` / `checkDeposit`: V = day `cash_deposit` / `check_deposit` (0 when none). **G: not present.**
  Passport safe drops record no tender, so the split does not exist. In the CSV both columns are empty.
- There is no over/short field: the POS does not record it.

---

## Drill-downs
### `GET /api/tickets/{file_id}/{ticket_seq}?store` (V only)
Use `file_id` and `ticket_seq` from a suspicious-event or cash-movement row. Response = one ticket:
`store_id, store_code, business_date, file_id, ticket_seq, ticket_id, trans_type, counts_as_sale,
is_suspended, is_fuel_prepay, is_rollback, is_prepay_completion, is_recalled, pos_num, tr_seq,
cashier_name, ticket_local, started_at, duration_sec, total, total_no_tax, total_tax, misc_ref,
orig_pos_num, orig_tr_seq, recall_pos_num, recall_tr_seq, has_age_check, file_name`, plus arrays:
- `lines`: `line_no, line_type, description, dept_number, dept_name, upc, signed_quantity, unit_price,
  line_total, promo_amount, net_amount, fuel_volume, void_line_ix, ...`
- `payments`: `line_no, paycode, payline_type, amount, signed_amount, card_name, entry_method, ...`
- `taxes`: `tax_sysid, tax_name, is_refund_tax, tax_rate, taxable_amount, tax_amount, ...`
- `related`: linked prepay deposit / completion / recalled tickets.
`404` when not found.

### `GET /api/events/{file_id}?store` (G only)
Use `file_id` from a suspicious-event, cash-movement or payment-gap row. Response = the transaction's
`event` columns plus `file_name, written_at, shift_begin`, and arrays `lines` (event lines plus
`dept_name, sales_class`), `payments` (tender lines), `taxes` (tax lines), `related`.

Show every field of a drill-down as returned. The dashboard runs no checks on drill-downs.

---

## Sign and unit cheat-sheet
| Value | V | G |
|---|---|---|
| day `lottery_payouts` | negative | negative |
| lottery / lottery-payouts `payout_amount` | positive | positive |
| departments `net_sales` of class `lottery_payout` | negative | negative |
| suspicious `void_line` amount | negative (value removed) | positive (regular price × quantity; `null` for a department ring) |
| suspicious `refund` amount | negative | negative |
| suspicious `void` amount | positive, before tax | positive, with tax |
| voids `void_line_amount`, `void_amount` | positive | positive |
| daily-register `refunds` | positive | positive |
| cash-movement `amount` | positive | positive |

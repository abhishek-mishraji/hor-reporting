# Data Schema Mapping: Gilbarco (PJR)

This document specifies the data model for the Gilbarco reporting service based on the Gilbarco Passport Journal Record (PJR) format.

The `report.*` views are owned by `gilbarco-ingestion-service` (`src/main/resources/db/migration/V3__pjr_report_views.sql`, plus `V4__department_refund_void.sql`). The counting rules live there, once; this service only reads the views. If this document and the migration disagree, the migration wins.

---

## 1. Overview of Gilbarco PJR Data Source

- **POS Architecture:** Per-transaction XML stream (`PJR` = Passport Journal Record)
- **Granularity:** 1 file = 1 customer event / transaction
- **Ingestion Target:** `gilbarco_db` (schemas `pjr`, `report`, `master`)
- **Store Identifier:** `store_code` (e.g., `800_NY-13208`), `store_id` (bigint)
- **Business Day Identifier:** `business_date` (date `YYYY-MM-DD`)
- **Transaction Identifier:** `file_id` (1 file = 1 transaction ID)

### Counting rules (from the migration)
- **Sales** = events with `counts_as_sale` (SaleEvent / RefundEvent, not a suspended prepay deposit; VoidEvents never). Sold lines = status `normal` only.
- **Amounts:** `net_amount` = after promotions; `gross_amount` = before promotions and discounts; `promo_amount` = gross − net.
- **Lottery:** classified by `master.departments.sales_class` (`lottery_sale` / `lottery_payout`). Payouts are never subtracted from sales.
- **Item sales** = scanned items (`ItemLine`) + department rings (`MerchandiseCodeLine`), merchandise only. Fuel and lottery are separate.
- **Void lines** are counted per transaction on sale/refund transactions. Cancel lines inside prepay deposits or voided transactions are separate kinds and never added to the main count.

---

## 2. Endpoint → Source Mapping

All filtered queries apply the shared `ApiSupport.FILTERS` clause (store, from, to) built from `ReportFilterParams`.

| Endpoint | Repository method | Source |
|---|---|---|
| `GET /api/reports/day-summary` | `getDaySummary` | `rpt_day_summary` + `rpt_void_daily` (void amounts) + `rpt_suspicious_daily` (refund amount) |
| `GET /api/v1/reports/daily-register` | `getDailyRegisterSummary` | `rpt_day_summary` + `rpt_suspicious_daily` (no-sales, refunds) + `rpt_void_daily` |
| `GET /api/reports/items-sold` | `getItemsSold` | `rpt_items_sold_daily` |
| `GET /api/reports/departments` | `getDepartments` | `rpt_department_daily` |
| `GET /api/v1/reports/departments/monthly` | `getMonthlyCseReport` | `rpt_department_daily` (aggregated per month) |
| `GET /api/reports/fuel` | `getFuel` | `rpt_fuel_daily` |
| `GET /api/reports/payments` | `getPayments` | `rpt_payment_daily` |
| `GET /api/reports/cash-movements` | `getCashMovements` | `rpt_cash_movement` |
| `GET /api/reports/suspicious/events` | `getSuspiciousEvents` | `rpt_suspicious_event` |
| `GET /api/reports/suspicious/daily` | `getSuspiciousDaily` | `rpt_suspicious_daily` |
| `GET /api/reports/lottery` | `getLottery` | `rpt_lottery_daily` |
| `GET /api/reports/lottery-payouts` | `getLotteryPayouts` | `rpt_lottery_payout_daily` |
| `GET /api/reports/voids` | `getVoids` | `rpt_void_daily` |
| `GET /api/reports/payment-gaps` | `getPaymentGaps` | `rpt_payment_gap` |
| `GET /api/reports/date-range` | `getDateRanges` | `pjr.pjr_file` |
| `GET /api/events/{fileId}` | `getEventDetail` | `pjr.event`, `pjr.pjr_file`, `pjr.event_line`, `master.departments`, `pjr.tender_line`, `pjr.event_tax` |

The `/api/v1/...` paths are also served without the `v1` prefix.

---

## 3. Report Schema Views in gilbarco_db

Every `rpt_*` view carries `store_id`, `store_code` and `business_date`; they are omitted from the column lists below.

### 3.1 Day Summary (`report.rpt_day_summary`)
One row per store per business day (the StoreClose summary).
- `files`, `shifts`, `period_opened`, `first_event`, `last_event`
- `customers`: counted sale/refund transactions; `pump_sales`: outside (pump) sales; `prepay_deposits`
- `merchandise_net` / `item_sales`: merchandise net sales (scanned items + department rings)
- `lottery_sales`, `lottery_payouts`, `lottery_payout_count` (payouts never netted)
- `fuel_sales` (gross), `fuel_net`, `fuel_gallons`
- `promotions`, `tax`
- `total_sales_before_tax`, `total_sales_with_tax`: lines net, excluding lottery payouts (+ tax)
- `payments_net`: sum of normal tender lines on counted transactions
- `payment_gaps`: count of `rpt_payment_gap` rows; `payments_tie`: `true` when `payment_gaps = 0`
- `safe_drops`, `safe_drop_amount`, `payouts`, `payout_amount`, `safe_loans`, `safe_loan_amount`
- `no_sales`, `void_lines`, `voids`, `refunds` (counts only; this service adds the dollar amounts from `rpt_void_daily` and `rpt_suspicious_daily`)

### 3.2 Items Sold (`report.rpt_items_sold_daily`)
Merchandise only.
- `item_type` (`scanned` / `department ring`), `upc`, `description`, `dept_number`, `dept_name`, `sales_class`, `units_sold`, `gross_sales`, `promotions`, `net_sales`, `tickets`.

### 3.3 Department Sales (`report.rpt_department_daily`)
Items, department rings and fuel; `sales_class` tells them apart.
- `dept_number`, `dept_name`, `sales_class`, `units_sold`, `gross_sales`, `promotions`, `net_sales`, `fuel_gallons`, `lines`.
- Added in `V4__department_refund_void.sql` (for the monthly department report), all shown positive:
  - `discount`: line discounts, already inside `promotions` (promotion without discounts = `promotions - discount`).
  - `refund`: refunded lines (negative gross, lottery payouts excluded).
  - `void_amount`: voided lines on counted transactions at regular price; never part of gross or net.

### 3.4 Lottery (`report.rpt_lottery_daily`)
Sales and payouts side by side, both positive, nothing netted.
- `sales_lines`, `sales_units`, `sales_amount`, `payouts`, `payout_amount`.

### 3.5 Lottery Payouts (`report.rpt_lottery_payout_daily`)
- `payouts`, `payout_amount` (positive: money paid to winners).

### 3.6 Fuel Sales (`report.rpt_fuel_daily`)
By grade and price tier.
- `fuel_grade_id`, `fuel_grade`, `fuel_price_level`, `gallons`, `amount` (gross), `net_amount`, `fuel_sales` (count), `fuel_discount`.
- `avg_price` is computed by this service (`amount / gallons`), not stored in the view.

### 3.7 Payments (`report.rpt_payment_daily`)
- `payment_type` (StoreClose name, e.g. `Cash`, `Credit`, `Crind DEBIT`), `tender_code`, `tender_sub`, `payments`, `sales_amount`, `refunds`, `refunded_amount`, `net_amount`.

### 3.8 Cash Movements (`report.rpt_cash_movement`)
One row per movement; amounts positive.
- `kind` (`safe_drop`, `payout`, `pay_in`, `safe_loan`), `occurred_at`, `register`, `cashier`, `till`, `ticket_number`, `file_id`, `amount`, `reference`.

### 3.9 Suspicious Events (`report.rpt_suspicious_event`)
Every occurrence.
- `occurred_at`, `kind`, `register`, `cashier`, `ticket_number`, `file_id`, `amount`, `item`, `quantity`, `duration_sec`, `detail`, `started_at`, `ended_at`, `lines`.
- `kind`: `no_sale`, `void_line`, `void_line_in_prepay_deposit`, `void_line_in_voided_transaction`, `void`, `refund`.

### 3.10 Suspicious Daily (`report.rpt_suspicious_daily`)
- `kind`, `occurrences`, `amount` (daily totals per kind from `rpt_suspicious_event`).

### 3.11 Voids (`report.rpt_void_daily`)
Every way of counting voids, one row per store-day that has files.
- `void_lines`, `voided_units`, `void_line_transactions`, `void_line_amount`, `void_ring_lines`
- `voids`, `void_amount` (= StoreClose "Transaction Voids"), `total_voids`, `total_void_amount`
- `deposit_void_lines`, `deposit_void_line_amount`, `voided_txn_void_lines`, `voided_txn_void_line_amount` (kept separate, never added in)

### 3.12 Payment Gaps (`report.rpt_payment_gap`)
One row per counted transaction whose payments differ from lines + tax.
- `file_id`, `ticket_number`, `register`, `started_at`, `ended_at`, `event_type`, `total_grand`, `paid`, `lines_plus_tax`, `gap`.

### 3.13 Event Drilldown (`pjr.event`, `pjr.event_line`, `pjr.tender_line`, `pjr.event_tax`, `pjr.pjr_file`)
- Full transaction event header, item lines (joined to `master.departments`), tender lines, taxes, and linked prepay deposit / completion transactions.

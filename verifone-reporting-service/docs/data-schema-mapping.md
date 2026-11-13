# Data Schema Mapping: Verifone (CPJ)

This document specifies the data model for the Verifone reporting service based on the Verifone Closed Period Journal (CPJ) format.

---

## 1. Overview of Verifone CPJ Data Source

- **POS Architecture:** Periodic batch journal XML (`CPJ` = Closed Period Journal)
- **Granularity:** 1 file = 1 closed business day (with all tickets inside)
- **Ingestion Target:** `verifone_db` (schemas `master`, `cpj`, `report`)
- **Store Identifier:** `store_code` (e.g., `8730_IN-47872`), `store_id` (bigint)
- **Business Day Identifier:** `business_date` (date `YYYY-MM-DD`)
- **Transaction Identifier:** `file_id` + `ticket_seq` (sequential ticket # within file)

---

## 2. Core Report Schema Views in verifone_db

### 2.1 Day Summary (`report.rpt_day_summary`)
Provides the executive overview and reconciliation for each business day:
- `store_code`: Unique store code
- `business_date`: Business operational date
- `customers`: Count of customer sale transactions
- `total_sales_with_tax`: Total customer receipts including sales tax
- `total_sales_before_tax`: Net taxable/non-taxable sales before tax
- `tax`: Total sales tax collected
- `grocery_total`: Total merchandise inside-store sales
- `fuel_sales`: Total dollars of fuel sold
- `fuel_volume`: Total fuel volume dispensed
- `lottery_sales`: Lottery ticket sales (never netted)
- `lottery_payouts`: Lottery winning payouts
- `promotions`: Sum of promotional and deal discounts
- `payments_net`: Sum of tender lines collected
- `counter_ties`: Boolean check that POS registers tie
- `safe_drops`: Count of register-to-safe drop events
- `cash_deposit`: Total cash dropped into safe
- `check_deposit`: Total checks dropped into safe
- `payout_amount`: Sum of non-lottery payout tickets
- Suspicious activity counts (from `report.rpt_suspicious_event`):
  - `no_sales`: Drawer opens without a sale
  - `void_lines`: Line-item voids (error corrections)
  - `voids`: Whole transactions voided
  - `refunds`: Refund lines
  - `refund_voids`: Refunds started and cancelled
- Suspicious activity amounts (positive dollars; joined in by the day-summary endpoint, not part of the view):
  - `void_line_amount`: Total of voided lines (from `report.rpt_void_daily`)
  - `void_amount`: Total of whole-ticket voids, before tax (from `report.rpt_void_daily`)
  - `total_void_amount`: `void_line_amount` + `void_amount`
  - `refund_amount`: Total of refund lines (from `report.rpt_suspicious_daily`)
- `period_opened`: Earliest transaction timestamp
- `period_closed`: Latest transaction timestamp

### 2.2 Items Sold (`report.rpt_items_sold_daily`)
- `store_code`, `business_date`, `item_type`, `upc`, `description`, `dept_number`, `dept_name`, `sales_class`, `units_sold`, `gross_sales`, `promotions`, `net_sales`, `tickets`.

### 2.3 Department Sales (`report.rpt_department_daily`)
- `store_code`, `business_date`, `dept_number`, `dept_name`, `sales_class`, `units_sold`, `gross_sales`, `promotions`, `net_sales`, `fuel_gallons`, `lines`.

### 2.4 Fuel Sales (`report.rpt_fuel_daily`)
- `store_code`, `business_date`, `fuel_grade`, `fuel_price_level`, `gallons`, `amount`, `fuel_sales`, `ppg_discount`, `avg_price`.

### 2.5 Payments (`report.rpt_payment_daily`)
- `store_code`, `business_date`, `payment_type`, `payments`, `sales_amount`, `refunds`, `refunded_amount`, `net_amount`.

### 2.6 Cash Movements (`report.rpt_cash_movement`)
- `store_code`, `business_date`, `occurred_at`, `kind`, `register`, `ticket_number`, `amount`, `reference`, `paid_with`.

### 2.7 Suspicious Events (`report.rpt_suspicious_event` & `report.rpt_suspicious_daily`)
- `occurred_at`, `kind`, `register`, `cashier`, `ticket_number`, `amount`, `item`, `duration_sec`.

### 2.8 Ticket Drilldown (`report.rpt_ticket`, `report.rpt_ticket_line`, `report.rpt_payment_line`, `report.rpt_ticket_tax`)
- Full receipt header, line items, tender payments, tax breakdown, and related prepay tickets.

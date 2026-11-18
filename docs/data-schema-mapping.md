# Data Schema Mapping: Verifone (CPJ) vs. Gilbarco (PJR)

This document specifies the exact mapping between Verifone CPJ and Gilbarco Passport PJR data models. It defines how the unified `reporting-service` normalizes both POS formats into a single, clean API contract for `client-portal`.

---

## 1. Overview of POS Data Sources

| Dimension | Verifone Commander / Ruby | Gilbarco Passport |
|---|---|---|
| **POS Architecture** | Periodic batch journal XML (`CPJ` = Closed Period Journal) | Per-transaction XML stream (`PJR` = Passport Journal Record) |
| **Granularity** | 1 file = 1 closed business day (with all tickets inside) | 1 file = 1 customer event / transaction |
| **Ingestion Target** | `verifone_db` (schemas `master`, `cpj`, `report`) | `gilbarco_db` (schema `pjr` or `public`, views `rpt_*`) |
| **Store Identifier** | `store_code` (e.g., `8730_IN-47872`), `store_id` (bigint) | `store_code` (e.g., `800_NY-13208`), `store_id` (bigint) |
| **Business Day Identifier**| `business_date` (date `YYYY-MM-DD`) | `business_date` (date `YYYY-MM-DD`) |
| **Transaction Identifier**| `file_id` + `ticket_seq` (sequential ticket # within file) | `file_id` (1 file = 1 transaction ID) |

---

## 2. Core Report Schema Mappings

### 2.1 Day Summary (`/api/reports/day-summary`)
Provides the executive overview and reconciliation for each business day.

| Unified Output Field | Verifone `report.daily_summary` / `rpt_day_summary` | Gilbarco `rpt_day_summary` | Description & Calculation Rules |
|---|---|---|---|
| `store_code` | `store_code` (or resolved from `store_id`) | `store_code` | Unique store code |
| `business_date` | `business_date` | `business_date` | Business operational date |
| `customers` | `customers` | `customers` | Count of customer sale transactions |
| `total_sales_with_tax` | `total_sales_with_tax` | `total_sales_with_tax` | Total customer receipts including sales tax |
| `total_sales_before_tax` | `total_sales_before_tax` | `total_sales_before_tax` | Net taxable/non-taxable sales before tax |
| `tax` | `tax` | `tax` | Total sales tax collected |
| `grocery_total` / `item_sales` | `grocery_total` | `item_sales` | Total merchandise inside-store sales |
| `fuel_sales` | `fuel_sales` | `fuel_sales` | Total dollars of fuel sold |
| `fuel_volume` / `fuel_gallons`| `volume` / `fuel_volume` | `fuel_gallons` | Total fuel volume dispensed |
| `lottery_sales` | `lottery_sales` | `lottery_sales` | Lottery ticket sales (never netted) |
| `lottery_payouts` | `lottery_payouts` | `lottery_payouts` | Lottery winning payouts (positive number) |
| `promotions` | `promotions` | `promotions` | Sum of promotional and deal discounts |
| `payments_net` | `payments_net` (or payments total) | `payments_net` | Sum of tender lines collected |
| `counter_ties` | `counter_ties` (sales_counter = tickets) | `counter_ties` (payments = sales + tax) | Boolean check that POS registers tie |
| `safe_drops` | `safe_drops` | `safe_drops` | Count of register-to-safe drop events |
| `cash_deposit` / `safe_drop_amt`| `cash_deposit` | `safe_drop_amount` | Total cash dropped into safe |
| `check_deposit` | `check_deposit` | `check_deposit` | Total checks dropped into safe |
| `payout_amount` | Sum of non-lottery payout tickets | `payout_amount` | Vendor/store paid-outs |
| `no_sale_count` | `no_sale_count` | `no_sale_count` | Drawer opens without transaction |
| `line_void_count` | `line_void_count` | `line_void_count` | Count of line-item error corrections |
| `line_void_amount` | `line_void_amount` | `line_void_amount` | Dollar total of voided lines |
| `void_count` | `void_count` | `void_count` | Entire transactions cancelled / voided |
| `void_amount` | `void_amount` | `void_amount` | Dollar total of full transaction voids |
| `refund_count` | `refund_count` | `refund_count` | Return/refund transactions |
| `refund_amount` | `refund_amount` | `refund_amount` | Dollar total of customer refunds |
| `period_opened` | `period_opened` | `period_opened` | Earliest transaction timestamp |
| `period_closed` | `period_closed` | `period_closed` | Latest transaction timestamp |

---

### 2.2 Items Sold (`/api/reports/items-sold`)
Analyzes scanned merchandise UPCs and department key-ins.

| Unified Output Field | Verifone `report.items_daily` / `rpt_items_sold_daily` | Gilbarco `rpt_items_sold_daily` | Description |
|---|---|---|---|
| `store_code` | `store_code` | `store_code` | Store identifier |
| `business_date` | `business_date` (when `byDay=true`) | `business_date` (when `byDay=true`) | Business date |
| `item_type` | `item_type` (`scanned` or `department ring`) | `item_type` (`scanned` or `department ring`) | Scanned barcode vs manual department ring |
| `upc` | `upc` | `upc` | Scanned barcode / POS code |
| `description` | `description` | `description` | Item description |
| `dept_number` | `dept_number` | `dept_number` | Store department ID |
| `dept_name` | `dept_name` | `dept_name` | Department name |
| `sales_class` | `sales_class` (`merchandise`) | `sales_class` (`merchandise`) | Sales classification |
| `units_sold` | `units` / `units_sold` | `units_sold` | Quantity sold |
| `gross_sales` | `gross` / `gross_sales` | `gross_sales` | Dollar amount before promotions |
| `promotions` | `promotion` / `promotions` | `promotions` | Discount/deal amount subtracted |
| `net_sales` | `net_sales` | `net_sales` | Actual collected revenue (`gross - promo`) |
| `tickets` | `tickets` | `tickets` | Number of customer tickets containing item |

---

### 2.3 Department Sales (`/api/reports/departments`)
Category and department level sales rollups.

| Unified Output Field | Verifone `report.department_daily` | Gilbarco `rpt_department_daily` | Description |
|---|---|---|---|
| `store_code` | `store_code` | `store_code` | Store identifier |
| `business_date` | `business_date` (when `byDay=true`) | `business_date` (when `byDay=true`) | Business date |
| `dept_number` | `dept_number` | `dept_number` | Department number |
| `dept_name` | `dept_name` | `dept_name` | Department name |
| `sales_class` | `sales_class` | `sales_class` | `merchandise`, `lottery_sale`, `lottery_payout`, `fuel` |
| `units_sold` | `units` | `units_sold` | Number of units |
| `gross_sales` | `gross` | `gross_sales` | Sales before promotions |
| `promotions` | `promotion` | `promotions` | Promotional deductions |
| `net_sales` | `net_sales` | `net_sales` | Final sales total |
| `fuel_gallons` | `fuel_volume` | `fuel_gallons` | Dispensed fuel volume (for fuel dept) |

---

### 2.4 Fuel Sales (`/api/reports/fuel`)
Gallons, dollars, and pricing breakdown per fuel grade.

| Unified Output Field | Verifone `report.fuel_daily` | Gilbarco `rpt_fuel_daily` | Description |
|---|---|---|---|
| `store_code` | `store_code` | `store_code` | Store identifier |
| `business_date` | `business_date` (when `byDay=true`) | `business_date` (when `byDay=true`) | Business date |
| `fuel_grade` | `fuel_grade` (e.g., Regular, Plus, Premium, Diesel) | `fuel_grade` | Fuel grade name |
| `fuel_price_level` | `fuel_price_level` (CASH vs CREDIT or tier) | `fuel_price_level` (Tier 0001 / 0002) | Price level tier |
| `gallons` | `volume` / `gallons` | `gallons` | Total gallons sold |
| `amount` | `amount` | `amount` | Gross dollar volume |
| `fuel_sales` | `fuel_sales` (transaction count) | `fuel_sales` | Count of fuel dispenses |
| `ppg_discount` | `ppg_discount` | `fuel_discount` | Loyalty cents-per-gallon discount total |
| `avg_price` | `round(amount / gallons, 3)` | `round(amount / gallons, 3)` | Average price per gallon |

---

### 2.5 Payments / Tenders (`/api/reports/payments`)
Payment reconciliation across tender methods.

| Unified Output Field | Verifone `report.payments_daily` | Gilbarco `rpt_payment_daily` | Description |
|---|---|---|---|
| `store_code` | `store_code` | `store_code` | Store identifier |
| `business_date` | `business_date` (when `byDay=true`) | `business_date` (when `byDay=true`) | Business date |
| `payment_type` | `payment_type` (CASH, DEBIT, CREDIT, EBT, etc.) | `payment_type` | Tender method name |
| `payments` | Count of payment lines | `payments` | Total payment transactions |
| `sales_amount` | `sales_amount` | `sales_amount` | Payments collected on sales |
| `refunds` | `refunds` | `refunds` | Refunds issued to tender |
| `refunded_amount` | `refunded_amount` | `refunded_amount` | Dollar amount refunded (e.g. cash on lottery) |
| `net_amount` | `net_amount` (`sales - refunded`) | `net_amount` | Net tender collection |

---

### 2.6 Cash Movements (`/api/reports/cash-movements`)
Non-sales register cash drawer movements.

| Unified Output Field | Verifone `report.cash_movements` | Gilbarco `rpt_cash_movement` | Description |
|---|---|---|---|
| `store_code` | `store_code` | `store_code` | Store identifier |
| `business_date` | `business_date` | `business_date` | Business date |
| `occurred_at` | `occurred_at` (timestamp) | `occurred_at` | Date and time of cash movement |
| `kind` | `safe_drop`, `payout`, `safe_loan` | `safe_drop`, `payout`, `safe_loan` | Movement type |
| `register` | `register` (terminal number) | `register` | POS terminal ID |
| `ticket_number` | `ticket_number` (sequence #) | `ticket_number` | Transaction / sequence number |
| `amount` | `amount` | `amount` | Dollar value of movement |
| `reference` | `reference` (payee name or drop #) | `reference` | Notes / Payee / Reason |
| `paid_with` | `paid_with` (CASH, CHECK) | `paid_with` | Tender used |

---

### 2.7 Suspicious Events & Daily Audit (`/api/reports/suspicious/*`)
Loss prevention and audit events.

| Unified Output Field | Verifone `report.suspicious_events` | Gilbarco `rpt_suspicious_event` | Description |
|---|---|---|---|
| `occurred_at` | `occurred_at` | `occurred_at` | Exact event timestamp |
| `kind` | `no_sale`, `void_line`, `void`, `refund`, `refund_void` | `no_sale`, `void_line`, `void`, `refund` | Audit category |
| `register` | `register` | `register` | POS register # |
| `cashier` | Cashier ID / name | `cashier` | Cashier on duty |
| `ticket_number` | `ticket_number` | `ticket_number` | Associated ticket ID |
| `amount` | `amount` (voided or refunded $) | `amount` | Impacted amount |
| `item` | `item` (UPC or description) | `item` | Description of voided line |
| `duration_sec` | `duration_sec` | Duration from start to end | Transaction duration |

---

### 2.8 Ticket / Receipt Drilldown (`/api/tickets/{fileId}/{ticketSeq}` or `/api/events/{fileId}`)

Unified drilldown response payload:
```json
{
  "header": {
    "store_code": "8730_IN-47872",
    "business_date": "2026-09-25",
    "ticket_number": 1284,
    "register": 1,
    "cashier": "JOHN",
    "trans_type": "sale",
    "sold_at": "2026-09-25T14:32:11",
    "total_grand": 45.50,
    "total_tax": 2.10,
    "total_no_tax": 43.40
  },
  "lines": [
    {
      "line_no": 1,
      "line_kind": "item",
      "upc": "01820000016",
      "description": "Bud Light 12pk Can",
      "quantity": 1,
      "unit_price": 14.99,
      "gross_amount": 14.99,
      "promo_amount": 0.00,
      "net_amount": 14.99,
      "dept_name": "Beer"
    }
  ],
  "payments": [
    {
      "line_no": 1,
      "payment_type": "CREDIT",
      "amount": 45.50
    }
  ],
  "taxes": [
    {
      "tax_name": "State Sales Tax",
      "rate_percent": 7.00,
      "tax_amount": 2.10
    }
  ],
  "related": []
}
```
